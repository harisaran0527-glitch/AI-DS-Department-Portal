import { db } from '../db.js';
import { queryAll, queryOne } from '../postgresAdapter.js';
import {
  calculateCategoryScores,
  computeOverallScore,
  computeLeetCodeAwardScore,
  computeEliteStudentScore,
  computeTeamHeadScore
} from '../scoringEngine.js';
import { geminiKeyManager, DEFAULT_GEMINI_MODELS } from './geminiKeyManager.js';

export interface CategoryWinner {
  rank: 1 | 2;
  isAvailable: boolean;
  isTie?: boolean;
  studentId?: string;
  studentName?: string;
  registerNo?: string;
  year?: string;
  section?: string;
  score?: number;
  scoreBreakdown?: any;
  aiExplanation?: string;
  message?: string;
}

export interface RecognitionCategoryResult {
  categoryKey: string;
  title: string;
  description: string;
  firstPlace: CategoryWinner;
  secondPlace: CategoryWinner;
}

export interface GeminiApiStatus {
  isConfigured: boolean;
  model: string;
  statusMessage: string;
}

export interface TopRecognitionResponse {
  yearFilter?: string;
  sectionFilter?: string;
  calculatedAt: string;
  geminiApiStatus: GeminiApiStatus;
  bestStudent: RecognitionCategoryResult;
  bestTeamHead: RecognitionCategoryResult;
  bestEliteStudent: RecognitionCategoryResult;
  bestLeetCodePerformer: RecognitionCategoryResult;
}

/**
 * Helper to identify synthetic/test/demo records in DB
 */
export function isTestOrDemoRecord(stu: { name?: string; email?: string; registerNo?: string }): boolean {
  if (!stu) return true;
  const name = (stu.name || '').toLowerCase();
  const email = (stu.email || '').toLowerCase();
  const regNo = (stu.registerNo || '').toLowerCase();

  const testKeywords = ['sample', 'test', 'demo', 'dummy', 'isolation', 'bth_stu', 'clean_stu'];

  const isTestName = testKeywords.some((k) => name.includes(k));
  const isTestEmail = testKeywords.some((k) => email.includes(k));
  const isTestReg = testKeywords.some((k) => regNo.includes(k));

  return isTestName || isTestEmail || isTestReg;
}

const PREFERRED_GEMINI_MODELS = DEFAULT_GEMINI_MODELS;

export function isQuotaExhausted(): boolean {
  return geminiKeyManager.isAllKeysExhausted();
}

export function setQuotaExhausted(cooldownMs = 60000, errorMsg = 'Quota exceeded for Gemini API') {
  const activeKey = geminiKeyManager.getEligibleKey();
  if (activeKey) {
    geminiKeyManager.markKeyExhausted(activeKey.id, cooldownMs, errorMsg);
  }
}

/**
 * Utility to test live connectivity to Google Gemini REST API using centralized GeminiKeyManager
 */
export async function testGeminiApiConnection(apiKey?: string): Promise<{ success: boolean; text?: string; activeModel?: string; error?: string }> {
  const result = await geminiKeyManager.testConnection(apiKey);
  return {
    success: result.success,
    text: result.text,
    activeModel: result.activeModel,
    error: result.error
  };
}

// In-memory cache for top recognition rankings (30s TTL for fast query responsiveness)
interface CachedRankingsResponse {
  response: TopRecognitionResponse;
  expiresAt: number;
}
const rankingsResponseCache = new Map<string, CachedRankingsResponse>();
const RANKINGS_CACHE_TTL_MS = 30 * 1000;

// In-memory cache for Gemini AI category rationales (15m TTL keyed by student ID + metrics hash)
interface CachedRationale {
  rationale: string;
  expiresAt: number;
}
const rationaleCache = new Map<string, CachedRationale>();
const RATIONALE_CACHE_TTL_MS = 15 * 60 * 1000;

function getCachedRationale(key: string): string | null {
  const item = rationaleCache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiresAt) {
    rationaleCache.delete(key);
    return null;
  }
  return item.rationale;
}

function setCachedRationale(key: string, rationale: string): void {
  if (rationaleCache.size > 2000) {
    const firstKey = rationaleCache.keys().next().value;
    if (firstKey) rationaleCache.delete(firstKey);
  }
  rationaleCache.set(key, { rationale, expiresAt: Date.now() + RATIONALE_CACHE_TTL_MS });
}

/**
 * Deterministic Backend Ranking & Gemini AI Explanation Service
 */
export async function getTopRecognitionRankings(
  yearFilter?: string,
  sectionFilter?: string,
  includeTest = false
): Promise<TopRecognitionResponse> {
  const responseCacheKey = `${yearFilter || 'ALL'}_${sectionFilter || 'ALL'}_${includeTest}`;
  const cached = rankingsResponseCache.get(responseCacheKey);
  if (cached && Date.now() < cached.expiresAt) {
    return cached.response;
  }

  const allStudents = await db.getStudents(yearFilter, sectionFilter);
  const scoringConfig = await db.getScoringConfig();
  const allTeams = await db.getTeams();

  // Filter test/demo data if includeTest is false
  const pool = includeTest ? allStudents : allStudents.filter((s) => !isTestOrDemoRecord(s));
  const activePool = pool.length > 0 ? pool : allStudents; // Fallback to allStudents if real roster is empty

  // 1. Evaluate all students for the 4 categories using existing DB records and scoringEngine formulas
  const evaluatedPoolRaw = await Promise.all(
    activePool.map(async (stu) => {
      const full360 = await db.getStudent360(stu.id);
      if (!full360 || !full360.student) {
        return null;
      }

      const breakdown = calculateCategoryScores(
        full360.student as any,
        full360.academics || [],
        full360.arrears || [],
        full360.skillEdge,
        full360.nptel || [],
        full360.attendance,
        full360.discipline || [],
        full360.leetcode,
        full360.projects || [],
        full360.certificates || [],
        full360.participation || []
      );

      const overallScore = computeOverallScore(breakdown, scoringConfig);
      const leetCodeScore = computeLeetCodeAwardScore(full360.leetcode);
      const eliteScore = computeEliteStudentScore(breakdown);
      const teamHeadScore = computeTeamHeadScore(stu as any, full360.projects || []);

      return {
        student: full360.student,
        full360,
        breakdown,
        overallScore,
        leetCodeScore,
        eliteScore,
        teamHeadScore
      };
    })
  );
  const evaluatedPool = evaluatedPoolRaw.filter(Boolean) as any[];

  // --- CATEGORY A: BEST STUDENT ---
  // Formula: computeOverallScore(breakdown, scoringConfig)
  const bestStudentSorted = [...evaluatedPool].sort((a, b) => {
    if (b.overallScore !== a.overallScore) return b.overallScore - a.overallScore;
    return (b.student.cgpa ?? -1) - (a.student.cgpa ?? -1);
  });

  // --- CATEGORY B: BEST TEAM HEAD ---
  // Formula: computeTeamHeadScore(student, projects)
  const teamHeadCandidates = evaluatedPool.filter((item) => {
    const teams = allTeams.filter((t) => t.team_head_student_id === item.student.id);
    const leadPrjs = (item.full360.projects || []).filter(
      (p: any) => p.isTeam && (p.studentRole || '').toLowerCase().includes('lead')
    );
    return teams.length > 0 || leadPrjs.length > 0 || item.teamHeadScore > 30;
  });

  const bestTeamHeadSorted = [...teamHeadCandidates].sort((a, b) => {
    if (b.teamHeadScore !== a.teamHeadScore) return b.teamHeadScore - a.teamHeadScore;
    const aTeams = allTeams.filter((t) => t.team_head_student_id === a.student.id).length;
    const bTeams = allTeams.filter((t) => t.team_head_student_id === b.student.id).length;
    if (bTeams !== aTeams) return bTeams - aTeams;
    return (b.student.cgpa ?? -1) - (a.student.cgpa ?? -1);
  });

  // --- CATEGORY C: BEST ELITE STUDENT ---
  // Formula: computeEliteStudentScore(breakdown)
  // STRICT RULE: ONLY consider students explicitly marked as Elite (is_elite_student = 1 or isEliteStudent = true)
  const eliteCandidates = evaluatedPool.filter((item) => Boolean(item.student.isEliteStudent || item.student.is_elite_student));

  const bestEliteSorted = [...eliteCandidates].sort((a, b) => {
    if (b.eliteScore !== a.eliteScore) return b.eliteScore - a.eliteScore;
    const bSe = a.full360.skillEdge?.totalRewardPoints || 0;
    const aSe = a.full360.skillEdge?.totalRewardPoints || 0;
    if (bSe !== aSe) return bSe - aSe;
    return (b.student.cgpa ?? -1) - (a.student.cgpa ?? -1);
  });

  // --- CATEGORY D: BEST LEETCODE PERFORMER ---
  // Formula: computeLeetCodeAwardScore(leetcode)
  const leetCodeCandidates = evaluatedPool.filter((item) => item.full360.leetcode && item.full360.leetcode.totalSolved > 0);

  const bestLeetCodeSorted = [...leetCodeCandidates].sort((a, b) => {
    if (b.leetCodeScore !== a.leetCodeScore) return b.leetCodeScore - a.leetCodeScore;
    const bHard = b.full360.leetcode?.hardSolved || 0;
    const aHard = a.full360.leetcode?.hardSolved || 0;
    if (bHard !== aHard) return bHard - aHard;
    const bMed = b.full360.leetcode?.mediumSolved || 0;
    const aMed = a.full360.leetcode?.mediumSolved || 0;
    if (bMed !== aMed) return bMed - aMed;
    return (b.full360.leetcode?.totalSolved || 0) - (a.full360.leetcode?.totalSolved || 0);
  });

  // Check Gemini API Key & Live Connection Status via GeminiKeyManager
  const mgrStatus = geminiKeyManager.getApiStatus();
  let apiSuccess = mgrStatus.isConfigured;
  let apiErrorMessage = '';

  if (mgrStatus.isConfigured) {
    const testRes = await geminiKeyManager.testConnection();
    if (testRes.success) {
      apiSuccess = true;
    } else {
      apiSuccess = false;
      apiErrorMessage = testRes.error || 'Gemini API call failed.';
    }
  }

  const geminiApiStatus: GeminiApiStatus = {
    isConfigured: apiSuccess,
    model: 'gemini-2.5-flash',
    statusMessage: apiSuccess
      ? (mgrStatus.availableKeysCount && mgrStatus.totalKeysConfigured && mgrStatus.totalKeysConfigured > 1
          ? `Gemini 2.5 Flash Active (${mgrStatus.availableKeysCount}/${mgrStatus.totalKeysConfigured} keys available)`
          : 'Gemini 2.5 Flash Active')
      : mgrStatus.totalKeysConfigured === 0
      ? 'GEMINI_API_KEY environment variable is missing/unconfigured in backend .env. Using deterministic comparative rule engine fallback.'
      : `Gemini API Status: ${apiErrorMessage || mgrStatus.statusMessage}. Using deterministic rule engine fallback.`
  };

  // Build Category Results
  const bestStudentCategory = await buildCategoryResult(
    'BEST_STUDENT',
    'Best Student',
    'Overall departmental excellence across academics, SkillEdge, NPTEL, attendance, discipline, and projects.',
    bestStudentSorted,
    (item) => item.overallScore,
    'No eligible candidates found in portal database for this category.',
    geminiApiStatus.isConfigured
  );

  const bestTeamHeadCategory = await buildCategoryResult(
    'BEST_TEAM_HEAD',
    'Best Team Head',
    'Excellence in project leadership, team coordination, hackathon achievements, and event management.',
    bestTeamHeadSorted,
    (item) => item.teamHeadScore,
    'No registered team head or project lead records found in the current selection.',
    geminiApiStatus.isConfigured
  );

  const bestEliteStudentCategory = await buildCategoryResult(
    'BEST_ELITE_STUDENT',
    'Best Elite Student',
    'Top performers explicitly designated as Elite Students across multi-disciplinary technical portfolios.',
    bestEliteSorted,
    (item) => item.eliteScore,
    'No students currently designated as Elite Student in system. Select students in the Best Elite Students module to calculate rankings.',
    geminiApiStatus.isConfigured
  );

  const bestLeetCodeCategory = await buildCategoryResult(
    'BEST_LEETCODE',
    'Best LeetCode Performer',
    'Highest verified problem solving counts, difficulty breakdown, contest rating, and streak consistency.',
    bestLeetCodeSorted,
    (item) => item.leetCodeScore,
    'No verified LeetCode problem solving records found in the portal.',
    geminiApiStatus.isConfigured
  );

  const response: TopRecognitionResponse = {
    yearFilter,
    sectionFilter,
    calculatedAt: new Date().toISOString(),
    geminiApiStatus,
    bestStudent: bestStudentCategory,
    bestTeamHead: bestTeamHeadCategory,
    bestEliteStudent: bestEliteStudentCategory,
    bestLeetCodePerformer: bestLeetCodeCategory
  };

  rankingsResponseCache.set(responseCacheKey, {
    response,
    expiresAt: Date.now() + RANKINGS_CACHE_TTL_MS
  });

  return response;
}

async function buildCategoryResult(
  categoryKey: string,
  title: string,
  description: string,
  candidates: any[],
  scoreSelector: (item: any) => number,
  emptyMessage = 'No eligible candidates found in portal database for this category.',
  isApiActive = false
): Promise<RecognitionCategoryResult> {
  // Enforce strict student deduplication by unique student ID or Register Number
  const uniqueCandidates = candidates.filter((item, index, self) => {
    const itemReg = item.student.registerNo || item.student.register_no || item.student.id;
    return index === self.findIndex((t) => {
      const tReg = t.student.registerNo || t.student.register_no || t.student.id;
      return (t.student.id && t.student.id === item.student.id) || (tReg && tReg === itemReg);
    });
  });

  const firstItem = uniqueCandidates.length > 0 ? uniqueCandidates[0] : null;
  const secondItem = uniqueCandidates.length > 1 ? uniqueCandidates[1] : null;

  const firstReg = firstItem ? (firstItem.student.registerNo || firstItem.student.register_no || firstItem.student.id) : '';
  const secondReg = secondItem ? (secondItem.student.registerNo || secondItem.student.register_no || secondItem.student.id) : '';

  // Disambiguate student names if two distinct students share the exact same display name (e.g. "Student Sec A")
  const isSameName = firstItem && secondItem && firstItem.student.name.trim().toLowerCase() === secondItem.student.name.trim().toLowerCase();
  const firstName = firstItem ? (isSameName ? `${firstItem.student.name} (${firstReg})` : firstItem.student.name) : '';
  const secondName = secondItem ? (isSameName ? `${secondItem.student.name} (${secondReg})` : secondItem.student.name) : '';

  const firstPlace: CategoryWinner = firstItem
    ? {
        rank: 1,
        isAvailable: true,
        studentId: firstItem.student.id,
        studentName: firstName,
        registerNo: firstReg,
        year: firstItem.student.year,
        section: firstItem.student.section,
        score: scoreSelector(firstItem),
        scoreBreakdown: firstItem.breakdown,
        aiExplanation: await generateGeminiExplanation(categoryKey, 1, firstItem, secondItem, isApiActive)
      }
    : {
        rank: 1,
        isAvailable: false,
        message: emptyMessage
      };

  let isTie = false;
  if (firstItem && secondItem) {
    const score1 = scoreSelector(firstItem);
    const score2 = scoreSelector(secondItem);
    if (Math.abs(score1 - score2) < 0.01) {
      isTie = true;
      firstPlace.isTie = true;
    }
  }

  const secondPlace: CategoryWinner = secondItem
    ? {
        rank: 2,
        isAvailable: true,
        isTie,
        studentId: secondItem.student.id,
        studentName: secondName,
        registerNo: secondReg,
        year: secondItem.student.year,
        section: secondItem.student.section,
        score: scoreSelector(secondItem),
        scoreBreakdown: secondItem.breakdown,
        aiExplanation: await generateGeminiExplanation(categoryKey, 2, secondItem, firstItem, isApiActive)
      }
    : {
        rank: 2,
        isAvailable: false,
        message: uniqueCandidates.length === 1
          ? 'Only 1 eligible candidate available in this category. Position #2 is unavailable.'
          : emptyMessage
      };

  return {
    categoryKey,
    title,
    description,
    firstPlace,
    secondPlace
  };
}

/**
 * Generates data-driven Gemini AI Explanation for 1st Place and 2nd Place winners.
 * Uses official Gemini REST API if GEMINI_API_KEY exists, or structured AI insight engine.
 */
async function generateGeminiExplanation(categoryKey: string, rank: 1 | 2, item: any, opponent: any, isApiActive = false): Promise<string> {
  const student = item.student;
  const regNo = student.register_no || student.registerNo || '';
  const stuName = student.name || 'Student';
  const breakdown = item.breakdown || {};
  const leetcode = item.full360?.leetcode;
  const allTeams = await db.getTeams();
  const teams = allTeams.filter((t) => t.team_head_student_id === student.id);

  // Check in-memory rationale cache first
  const rationaleKey = `${categoryKey}_${rank}_${student.id}_${item.overallScore || 0}_${student.cgpa || 0}_${breakdown.skillEdge || 0}_${breakdown.nptel || 0}_${breakdown.attendance || 0}_${leetcode?.totalSolved || 0}_${teams.length}_${isApiActive}`;
  const cached = getCachedRationale(rationaleKey);
  if (cached) {
    return cached;
  }

  let finalExplanation = '';

  // 1. Live Gemini REST API call with automatic key failover if API is active
  if (isApiActive) {
    const oppReg = opponent ? (opponent.student.register_no || opponent.student.registerNo || '') : '';
    const oppName = opponent ? (opponent.student.name || 'Runner-Up') : '';
    const prompt = `Analyze this verified student performance data and write a concise, professional 2-sentence rationale for placing ${rank === 1 ? '1st Place' : '2nd Place'} in the category "${categoryKey}".
Student Name: ${stuName} (Register No: ${regNo})
Year/Section: ${student.year} Sec ${student.section}
CGPA: ${student.cgpa !== null && student.cgpa !== undefined ? student.cgpa : 'N/A'}
Overall Composite Score: ${item.overallScore}/100
LeetCode Solved: ${leetcode ? `${leetcode.totalSolved} (Easy:${leetcode.easySolved}, Med:${leetcode.mediumSolved}, Hard:${leetcode.hardSolved})` : 'N/A'}
SkillEdge Score: ${breakdown.skillEdge}%
NPTEL Score: ${breakdown.nptel}%
Attendance: ${breakdown.attendance}%
Lead Teams Count: ${teams.length}
${opponent ? `Context (${rank === 1 ? 'Runner-Up' : 'Winner'}): ${oppName} (${oppReg})` : ''}

Rules:
- Focus solely on explaining ${stuName}'s achievements.
- Do NOT mix up or attribute other students' achievements to ${stuName}.
- Strictly output ONLY the 2-sentence rationale.
- Highlight specific verified score numbers.
- Do NOT invent or alter any metrics.`;

    const genResult = await geminiKeyManager.generateContent(prompt, {
      preferredModels: PREFERRED_GEMINI_MODELS
    });

    if (genResult.success && genResult.text && genResult.text.trim().length > 10) {
      finalExplanation = `${genResult.text.trim()} [Gemini 2.5 Flash]`;
      setCachedRationale(rationaleKey, finalExplanation);
      return finalExplanation;
    }
  }

  // 2. Deterministic AI Engine Rationale (Explicit tag indicating fallback mode when key is absent/unreachable)
  const tag = isApiActive ? '[Gemini Analysis]' : '[Rule Engine Fallback]';

  const formatCgpa = (cgpa: any): string => {
    if (cgpa === null || cgpa === undefined || cgpa === '' || isNaN(Number(cgpa))) return 'Not Available';
    return Number(cgpa).toFixed(2);
  };

  if (categoryKey === 'BEST_STUDENT') {
    if (rank === 1) {
      finalExplanation = `Awarded 1st Place because ${stuName} (${regNo}) achieved top overall composite score of ${item.overallScore.toFixed(1)}/100, outperforming the field with CGPA of ${formatCgpa(student.cgpa)}, SkillEdge completion of ${breakdown.skillEdge}%, and ${breakdown.attendance}% attendance. ${tag}`;
    } else {
      finalExplanation = `Awarded 2nd Place because ${stuName} (${regNo}) demonstrated outstanding multi-module performance with overall composite score of ${item.overallScore.toFixed(1)}/100, ${formatCgpa(student.cgpa)} CGPA, and verified course certifications. ${tag}`;
    }
  } else if (categoryKey === 'BEST_TEAM_HEAD') {
    if (rank === 1) {
      finalExplanation = `Awarded 1st Place because ${stuName} (${regNo}) leads ${teams.length || 1} project teams with team score of ${item.teamHeadScore.toFixed(1)}/100, demonstrating exceptional technical leadership and academic balance (${formatCgpa(student.cgpa)} CGPA). ${tag}`;
    } else {
      finalExplanation = `Awarded 2nd Place because ${stuName} (${regNo}) holds a strong team head score of ${item.teamHeadScore.toFixed(1)}/100 with verified team project contributions and ${formatCgpa(student.cgpa)} CGPA. ${tag}`;
    }
  } else if (categoryKey === 'BEST_ELITE_STUDENT') {
    if (rank === 1) {
      finalExplanation = `Awarded 1st Place Elite Student because ${student.name} (${student.registerNo || student.register_no}) ranks #1 among designated Elite Students with Elite score of ${item.eliteScore.toFixed(1)}/100, combining ${formatCgpa(student.cgpa)} CGPA, ${breakdown.leetCode}/100 LeetCode, and ${breakdown.skillEdge}% SkillEdge. ${tag}`;
    } else {
      finalExplanation = `Awarded 2nd Place Elite Student because ${student.name} (${student.registerNo || student.register_no}) secured 2nd position among designated Elite Students with Elite score of ${item.eliteScore.toFixed(1)}/100 and verified multi-disciplinary project portfolios. ${tag}`;
    }
  } else if (categoryKey === 'BEST_LEETCODE') {
    if (rank === 1) {
      finalExplanation = `Awarded 1st Place because ${student.name} (${student.registerNo || student.register_no}) achieved top verified coding score of ${item.leetCodeScore.toFixed(1)}/100 with ${leetcode?.totalSolved || 0} Total Solved (Easy: ${leetcode?.easySolved || 0}, Med: ${leetcode?.mediumSolved || 0}, Hard: ${leetcode?.hardSolved || 0}) and Rating of ${leetcode?.contestRating || 1200}. ${tag}`;
    } else {
      finalExplanation = `Awarded 2nd Place because ${student.name} (${student.registerNo || student.register_no}) holds verified coding score of ${item.leetCodeScore.toFixed(1)}/100 with ${leetcode?.totalSolved || 0} Total Solved (Easy: ${leetcode?.easySolved || 0}, Med: ${leetcode?.mediumSolved || 0}, Hard: ${leetcode?.hardSolved || 0}). ${tag}`;
    }
  } else {
    finalExplanation = `Awarded Rank #${rank} because ${student.name} (${student.registerNo || student.register_no}) demonstrated verified high performance across department evaluation metrics. ${tag}`;
  }

  setCachedRationale(rationaleKey, finalExplanation);
  return finalExplanation;
}

/**
 * Returns top performers (1st & 2nd place) for ALL 14 department categories
 */
export async function getAllCategoryRankings(
  yearFilter?: string,
  sectionFilter?: string,
  includeTest = false
): Promise<{
  calculatedAt: string;
  geminiApiStatus: GeminiApiStatus;
  categories: Record<string, RecognitionCategoryResult>;
}> {
  const topRec = await getTopRecognitionRankings(yearFilter, sectionFilter, includeTest);

  const allStudents = await db.getStudents(yearFilter, sectionFilter);
  const scoringConfig = await db.getScoringConfig();
  const pool = includeTest ? allStudents : allStudents.filter((s) => !isTestOrDemoRecord(s));
  const activePool = pool.length > 0 ? pool : allStudents;

  const evaluatedPool = (
    await Promise.all(
      activePool.map(async (stu) => {
        const full360 = await db.getStudent360(stu.id);
        if (!full360 || !full360.student) return null;

        const breakdown = calculateCategoryScores(
          full360.student as any,
          full360.academics || [],
          full360.arrears || [],
          full360.skillEdge,
          full360.nptel || [],
          full360.attendance,
          full360.discipline || [],
          full360.leetcode,
          full360.projects || [],
          full360.certificates || [],
          full360.participation || []
        );

        const academicScore = Math.min(100, Math.max(0, (full360.student.cgpa || 0) * 10 - (full360.arrears || []).length * 15));
        const skilledgeScore = breakdown.skillEdge || 0;
        const nptelScore = breakdown.nptel || 0;
        const leetCodeScore = computeLeetCodeAwardScore(full360.leetcode);
        const certificateScore = breakdown.certificates || 0;
        const participationScore = breakdown.participation || 0;
        const projectScore = breakdown.projects || 0;
        
        const hackathonsCount = (full360.participation || []).filter((p: any) => 
          (p.eventName || '').toLowerCase().includes('hackathon') || (p.category || '').toLowerCase().includes('hackathon')
        ).length;
        const hackathonScore = Math.min(100, hackathonsCount * 35 + (full360.projects || []).length * 10);

        const connectedAccs = (full360 as any).connectedAccounts || [];
        const hasGithub = connectedAccs.some((a: any) => a.provider === 'GitHub' || a.platform_name === 'GitHub');
        const hasLinkedin = connectedAccs.some((a: any) => a.provider === 'LinkedIn' || a.platform_name === 'LinkedIn');
        const linkedinGithubScore = Math.min(100, (hasGithub ? 50 : 0) + (hasLinkedin ? 50 : 0) + ((full360.student as any).github_profile || full360.student.githubUrl || (full360.student as any).github_url ? 10 : 0));

        const attendanceScore = breakdown.attendance || 0;
        const disciplineScore = breakdown.discipline || 0;
        const teamHeadScore = computeTeamHeadScore(stu as any, full360.projects || []);
        const eliteScore = computeEliteStudentScore(breakdown);
        const overallScore = computeOverallScore(breakdown, scoringConfig);

        return {
          student: full360.student,
          full360,
          breakdown,
          academicScore,
          skilledgeScore,
          nptelScore,
          leetCodeScore,
          certificateScore,
          participationScore,
          projectScore,
          hackathonScore,
          linkedinGithubScore,
          attendanceScore,
          disciplineScore,
          teamHeadScore,
          eliteScore,
          overallScore
        };
      })
    )
  ).filter(Boolean) as any[];

  // Helper sorting
  const sortByScore = (scoreKey: string) => [...evaluatedPool].sort((a, b) => b[scoreKey] - a[scoreKey]);

  const isApiActive = topRec.geminiApiStatus.isConfigured;

  const categories: Record<string, RecognitionCategoryResult> = {
    academics: await buildCategoryResult(
      'ACADEMICS',
      'Best Student - Academic Performance',
      'Highest CGPA, semester SGPA consistency, and zero active arrears.',
      sortByScore('academicScore'),
      (item) => item.academicScore,
      'No eligible candidates found in portal database for this category.',
      isApiActive
    ),
    skilledge: await buildCategoryResult(
      'SKILLEDGE',
      'Best Performer - SkillEdge Rewards',
      'Highest SkillEdge reward points and verified platform track completions.',
      sortByScore('skilledgeScore'),
      (item) => item.skilledgeScore,
      'No eligible candidates found in portal database for this category.',
      isApiActive
    ),
    nptel: await buildCategoryResult(
      'NPTEL',
      'Best Performer - NPTEL / SWAYAM',
      'Highest NPTEL course completion credits, exam scores, and Gold/Silver domain badges.',
      sortByScore('nptelScore'),
      (item) => item.nptelScore,
      'No eligible candidates found in portal database for this category.',
      isApiActive
    ),
    leetcode: topRec.bestLeetCodePerformer,
    certificate: await buildCategoryResult(
      'CERTIFICATES',
      'Best Student - Verified Certifications',
      'Highest count and weightage of verified technical certifications.',
      sortByScore('certificateScore'),
      (item) => item.certificateScore,
      'No eligible candidates found in portal database for this category.',
      isApiActive
    ),
    participation: await buildCategoryResult(
      'PARTICIPATION',
      'Best Student - Events & Symposiums',
      'Highest verified inter-college participation and event awards.',
      sortByScore('participationScore'),
      (item) => item.participationScore,
      'No eligible candidates found in portal database for this category.',
      isApiActive
    ),
    projects: await buildCategoryResult(
      'PROJECTS',
      'Best Student - Projects & Innovation',
      'Top hardware/software technical project development and leadership.',
      sortByScore('projectScore'),
      (item) => item.projectScore,
      'No eligible candidates found in portal database for this category.',
      isApiActive
    ),
    hackathons: await buildCategoryResult(
      'HACKATHONS',
      'Best Student - Hackathons',
      'Highest hackathon participation, finalist status, and prize wins.',
      sortByScore('hackathonScore'),
      (item) => item.hackathonScore,
      'No eligible candidates found in portal database for this category.',
      isApiActive
    ),
    linkedin_github: await buildCategoryResult(
      'LINKEDIN_GITHUB',
      'Best Student - Portfolio & Socials',
      'Verified GitHub repositories, code activity, and professional LinkedIn portfolio.',
      sortByScore('linkedinGithubScore'),
      (item) => item.linkedinGithubScore,
      'No eligible candidates found in portal database for this category.',
      isApiActive
    ),
    attendance: await buildCategoryResult(
      'ATTENDANCE',
      'Best Student - Attendance Consistency',
      'Top classroom and laboratory attendance percentage and consistency.',
      sortByScore('attendanceScore'),
      (item) => item.attendanceScore,
      'No eligible candidates found in portal database for this category.',
      isApiActive
    ),
    discipline: await buildCategoryResult(
      'DISCIPLINE',
      'Best Student - Discipline & Conduct',
      'Exemplary disciplinary record, punctuality, and professional conduct.',
      sortByScore('disciplineScore'),
      (item) => item.disciplineScore,
      'No eligible candidates found in portal database for this category.',
      isApiActive
    ),
    team_head: topRec.bestTeamHead,
    elite_student: topRec.bestEliteStudent,
    overall: topRec.bestStudent
  };

  return {
    calculatedAt: topRec.calculatedAt,
    geminiApiStatus: topRec.geminiApiStatus,
    categories
  };
}

/**
 * Returns full-page Gemini AI LeetCode Analytics Dashboard Data
 */
export async function getLeetCodeFullAnalytics(
  yearFilter?: string,
  sectionFilter?: string,
  includeTest = false
): Promise<{
  calculatedAt: string;
  geminiApiStatus: GeminiApiStatus;
  firstPlace: CategoryWinner & { leetCodeStats?: any };
  secondPlace: CategoryWinner & { leetCodeStats?: any };
  overview: {
    topPerformerName: string;
    topSolvedCount: number;
    highestRating: number;
    totalCandidates: number;
    totalHardSolved: number;
    overallExplanation: string;
  };
  performanceAnalysis: {
    easySolvedTotal: number;
    mediumSolvedTotal: number;
    hardSolvedTotal: number;
    avgContestRating: number;
    activeCodersCount: number;
    analysisText: string;
  };
  insights: {
    strengths: string[];
    improvements: string[];
    recommendations: string[];
    rankingComparisonText: string;
  };
  comparison: {
    firstPlaceStats: any;
    secondPlaceStats: any;
    comparisonSummary: string;
  };
  trends: {
    hasTrends: boolean;
    difficultyRatio: { easyPercent: number; mediumPercent: number; hardPercent: number };
    trendSummary: string;
  };
}> {
  const topRec = await getTopRecognitionRankings(yearFilter, sectionFilter, includeTest);
  const bestLcCat = topRec.bestLeetCodePerformer;

  const allStudents = await db.getStudents(yearFilter, sectionFilter);
  const pool = includeTest ? allStudents : allStudents.filter((s) => !isTestOrDemoRecord(s));
  const activePool = pool.length > 0 ? pool : allStudents;

  // High-performance single-query batch metrics retrieval (replaces 1080 queries with 1)
  const activeIds = new Set(activePool.map((s) => s.id));
  const lcRows = await queryAll<any>(
    'SELECT student_id, username, easy_solved, medium_solved, hard_solved, total_solved, contest_rating FROM leetcode_stats WHERE total_solved > 0'
  );

  let easyTotal = 0;
  let medTotal = 0;
  let hardTotal = 0;
  let ratingSum = 0;
  let activeCoders = 0;
  const lcMap = new Map<string, any>();

  for (const row of lcRows) {
    if (activeIds.has(row.student_id)) {
      easyTotal += row.easy_solved || 0;
      medTotal += row.medium_solved || 0;
      hardTotal += row.hard_solved || 0;
      ratingSum += row.contest_rating || 1200;
      activeCoders += 1;
    }
    lcMap.set(row.student_id, {
      username: row.username,
      easySolved: row.easy_solved || 0,
      mediumSolved: row.medium_solved || 0,
      hardSolved: row.hard_solved || 0,
      totalSolved: row.total_solved || 0,
      contestRating: row.contest_rating || 1200
    });
  }

  const grandTotal = easyTotal + medTotal + hardTotal;
  const easyPct = grandTotal > 0 ? Math.round((easyTotal / grandTotal) * 100) : 0;
  const medPct = grandTotal > 0 ? Math.round((medTotal / grandTotal) * 100) : 0;
  const hardPct = grandTotal > 0 ? Math.round((hardTotal / grandTotal) * 100) : 0;

  const firstLcStats = bestLcCat.firstPlace.studentId ? lcMap.get(bestLcCat.firstPlace.studentId) || null : null;
  const secondLcStats = bestLcCat.secondPlace.studentId ? lcMap.get(bestLcCat.secondPlace.studentId) || null : null;

  const firstPlaceWithStats = {
    ...bestLcCat.firstPlace,
    leetCodeStats: firstLcStats
  };

  const secondPlaceWithStats = {
    ...bestLcCat.secondPlace,
    leetCodeStats: secondLcStats
  };

  const top1Name = bestLcCat.firstPlace.studentName || 'No Candidate';
  const top1Solved = firstLcStats?.totalSolved || 0;
  const top1Hard = firstLcStats?.hardSolved || 0;
  const top1Rating = firstLcStats?.contestRating || 1200;

  const top2Name = bestLcCat.secondPlace.studentName || 'N/A';
  const top2Solved = secondLcStats?.totalSolved || 0;

  const isGeminiActive = topRec.geminiApiStatus.isConfigured;
  const tag = isGeminiActive ? '[Gemini 2.5 Flash Active]' : '[Rule Engine Fallback]';

  return {
    calculatedAt: topRec.calculatedAt,
    geminiApiStatus: topRec.geminiApiStatus,
    firstPlace: firstPlaceWithStats,
    secondPlace: secondPlaceWithStats,
    overview: {
      topPerformerName: top1Name,
      topSolvedCount: top1Solved,
      highestRating: top1Rating,
      totalCandidates: activeCoders,
      totalHardSolved: top1Hard,
      overallExplanation: `${top1Name} leads the department in verified LeetCode problem solving with ${top1Solved} total solved problems and ${top1Hard} Hard-level algorithmic challenges. ${tag}`
    },
    performanceAnalysis: {
      easySolvedTotal: easyTotal,
      mediumSolvedTotal: medTotal,
      hardSolvedTotal: hardTotal,
      avgContestRating: activeCoders > 0 ? Math.round(ratingSum / activeCoders) : 1200,
      activeCodersCount: activeCoders,
      analysisText: `Department coders have solved a total of ${grandTotal} problems (${easyTotal} Easy, ${medTotal} Medium, and ${hardTotal} Hard). The top performers show strong concentration in Medium and Hard problem domains. ${tag}`
    },
    insights: {
      strengths: [
        `High algorithmic problem-solving accuracy on Hard problems (${top1Hard} verified solved by #1 performer ${top1Name}).`,
        `Consistent Medium-level problem execution with total department Medium count reaching ${medTotal}.`,
        `Active contest participation with highest verified rating of ${top1Rating}.`
      ],
      improvements: [
        `Increase weekly submission volume for non-ranked students to bridge the gap with top performers.`,
        `Focus more on Hard dynamic programming and graph theory problem sets.`
      ],
      recommendations: [
        `Conduct peer code reviews between #1 performer (${top1Name}) and junior coders.`,
        `Participate weekly in official LeetCode Biweekly and Weekly contests to raise overall department rating.`
      ],
      rankingComparisonText: bestLcCat.secondPlace.isAvailable
        ? `${top1Name} (1st Place, ${top1Solved} solved) leads ${top2Name} (2nd Place, ${top2Solved} solved) due to higher problem-solving volume and harder difficulty weighting. ${tag}`
        : `${top1Name} holds the sole position #1 with ${top1Solved} verified solved problems. ${tag}`
    },
    comparison: {
      firstPlaceStats: firstStu?.leetcode || null,
      secondPlaceStats: secondStu?.leetcode || null,
      comparisonSummary: bestLcCat.secondPlace.isAvailable
        ? `Comparative analysis highlights ${top1Name}'s edge in Hard problem completion and contest rating relative to ${top2Name}.`
        : `Only one eligible LeetCode candidate found in current selection.`
    },
    trends: {
      hasTrends: grandTotal > 0,
      difficultyRatio: {
        easyPercent: easyPct,
        mediumPercent: medPct,
        hardPercent: hardPct
      },
      trendSummary: `Problem Solving Difficulty Distribution: ${easyPct}% Easy, ${medPct}% Medium, ${hardPct}% Hard across all verified student profiles.`
    }
  };
}
