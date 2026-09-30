import { db } from '../db.js';
import { calculateCategoryScores, computeOverallScore } from '../scoringEngine.js';

export interface LeetCodeSyncResult {
  username: string;
  easySolved: number;
  mediumSolved: number;
  hardSolved: number;
  totalSolved: number;
  totalAttempted?: number;
  acceptanceRate?: number;
  contestRating: number;
  ranking: number;
  verificationStatus: string;
  syncedAt: string;
}

export async function syncLeetCodeProfile(studentId: string, inputHandleOrEmail: string): Promise<LeetCodeSyncResult> {
  if (!studentId || !inputHandleOrEmail) {
    throw new Error('studentId and LeetCode username or email are required.');
  }

  const rawInput = inputHandleOrEmail.trim();
  let cleanUsername = rawInput;

  // Handle email-based input lookup
  if (rawInput.includes('@')) {
    const full360 = await db.getStudent360(studentId);
    const connAccs = await db.getConnectedAccounts(studentId);
    const lcConn = connAccs.find((a: any) => a.provider === 'LeetCode');
    const existingHandle = lcConn?.provider_username || full360?.leetcode?.username;

    if (existingHandle && !['student', 'leetcode_user', 'null', 'undefined'].includes(existingHandle.toLowerCase())) {
      cleanUsername = existingHandle.trim();
    } else {
      const prefix = rawInput.split('@')[0].trim();
      if (/^[a-zA-Z0-9_-]{2,50}$/.test(prefix)) {
        cleanUsername = prefix;
      } else {
        throw new Error(`Could not resolve LeetCode handle from email "${rawInput}". Please enter the student's exact LeetCode username.`);
      }
    }
  }

  // Handle full LeetCode profile URLs (e.g. https://leetcode.com/u/username/ or leetcode.com/username)
  if (cleanUsername.includes('leetcode.com')) {
    const urlMatch = cleanUsername.match(/leetcode\.com\/(?:u\/)?([a-zA-Z0-9_-]+)/i);
    if (urlMatch && urlMatch[1]) {
      cleanUsername = urlMatch[1].trim();
    }
  }

  if (!/^[a-zA-Z0-9_-]{2,50}$/.test(cleanUsername) || ['student', 'leetcode_user', 'null', 'undefined'].includes(cleanUsername.toLowerCase())) {
    throw new Error(`Invalid LeetCode handle format: "${cleanUsername}". LeetCode handle must contain 2-50 characters (letters, numbers, hyphens, or underscores).`);
  }

  let easySolved = 0;
  let mediumSolved = 0;
  let hardSolved = 0;
  let totalSolved = 0;
  let totalAttempted = 0;
  let acceptanceRate = 0;
  let contestRating = 1200;
  let ranking = 0;
  let verified = false;
  let fetchError = '';

  // 1. Primary: Official LeetCode GraphQL Query
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 7000);

    const gqlRes = await fetch('https://leetcode.com/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      body: JSON.stringify({
        query: `
          query getUserProfile($username: String!) {
            matchedUser(username: $username) {
              username
              profile { ranking reputation realName }
              submitStats: submitStatsGlobal {
                acSubmissionNum { difficulty count submissions }
                totalSubmissionNum { difficulty count submissions }
              }
            }
            userContestRanking(username: $username) { rating globalRanking }
          }
        `,
        variables: { username: cleanUsername }
      }),
      signal: controller.signal
    }).catch(() => null);

    clearTimeout(timeoutId);

    if (gqlRes && gqlRes.ok) {
      const data = await gqlRes.json();
      if (data?.data?.matchedUser) {
        verified = true;
        const matched = data.data.matchedUser;
        const acStats = matched.submitStats?.acSubmissionNum || [];
        const totalStats = matched.submitStats?.totalSubmissionNum || [];

        for (const item of acStats) {
          if (item.difficulty === 'All') totalSolved = item.count || 0;
          if (item.difficulty === 'Easy') easySolved = item.count || 0;
          if (item.difficulty === 'Medium') mediumSolved = item.count || 0;
          if (item.difficulty === 'Hard') hardSolved = item.count || 0;
        }

        for (const item of totalStats) {
          if (item.difficulty === 'All') totalAttempted = item.submissions || 0;
        }

        if (matched.profile?.ranking) {
          ranking = matched.profile.ranking;
        }

        if (data.data.userContestRanking?.rating) {
          contestRating = Math.round(data.data.userContestRanking.rating);
        }

        if (totalAttempted > 0 && totalSolved > 0) {
          acceptanceRate = parseFloat(((totalSolved / totalAttempted) * 100).toFixed(1));
        }
      }
    }
  } catch (err: any) {
    fetchError = err.message;
  }

  // 2. Secondary Fallback: Alfa LeetCode Public API
  if (!verified) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 7000);

      const alfaRes = await fetch(`https://alfa-leetcode-api.onrender.com/userProfile/${encodeURIComponent(cleanUsername)}`, {
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (alfaRes && alfaRes.ok) {
        const alfaData = await alfaRes.json();
        if (alfaData && (alfaData.totalSolved !== undefined || alfaData.easySolved !== undefined)) {
          verified = true;
          easySolved = alfaData.easySolved || 0;
          mediumSolved = alfaData.mediumSolved || 0;
          hardSolved = alfaData.hardSolved || 0;
          totalSolved = alfaData.totalSolved || (easySolved + mediumSolved + hardSolved);
          ranking = alfaData.ranking || 0;
          contestRating = alfaData.contestRating || 1200;
          acceptanceRate = alfaData.acceptanceRate || 0;
        }
      }
    } catch (_err) {
      // Fallback silently if third party API is unreachable
    }
  }

  if (!verified) {
    throw new Error(fetchError || `Failed to verify LeetCode username "${cleanUsername}". Please make sure the profile handle exists on LeetCode.`);
  }

  const now = new Date().toISOString();

  // Save Connection Status
  await db.upsertConnectedAccount(studentId, 'LeetCode', cleanUsername, 'Connected', 'VERIFIED', {
    easySolved,
    mediumSolved,
    hardSolved,
    totalSolved,
    totalAttempted,
    acceptanceRate,
    contestRating,
    ranking,
    syncedAt: now
  });

  // Store Individual External Metrics
  await db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'totalSolved', totalSolved, 'VERIFIED');
  await db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'easySolved', easySolved, 'VERIFIED');
  await db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'mediumSolved', mediumSolved, 'VERIFIED');
  await db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'hardSolved', hardSolved, 'VERIFIED');
  await db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'totalAttempted', totalAttempted, 'VERIFIED');
  await db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'acceptanceRate', acceptanceRate, 'VERIFIED');
  await db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'contestRating', contestRating, 'VERIFIED');
  await db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'ranking', ranking, 'VERIFIED');

  // Update leetcode_stats table with explicit totalSolved
  await db.updateLeetCode(studentId, cleanUsername, easySolved, mediumSolved, hardSolved, contestRating, totalAttempted, acceptanceRate, totalSolved);

  // Recalculate student composite score & rank
  const student = await db.getStudentById(studentId);
  if (student) {
    const full360 = (await db.getStudent360(studentId))!;
    const scoringConfig = await db.getScoringConfig();
    const categoryScores = calculateCategoryScores(
      full360.student as any,
      full360.academics,
      full360.arrears,
      full360.skillEdge,
      full360.nptel,
      full360.attendance,
      full360.discipline,
      full360.leetcode,
      full360.projects
    );
    const newOverallScore = computeOverallScore(categoryScores, scoringConfig) || 0;

    const sectionStudents = await db.getStudents(student.year, student.section);
    for (let idx = 0; idx < sectionStudents.length; idx++) {
      const s = sectionStudents[idx];
      const sScore = s.id === studentId ? newOverallScore : (s.overall_score || 0);
      await db.updateStudentScoreAndRank(s.id, sScore, idx + 1);
    }
  }

  return {
    username: cleanUsername,
    easySolved,
    mediumSolved,
    hardSolved,
    totalSolved,
    totalAttempted,
    acceptanceRate,
    contestRating,
    ranking,
    verificationStatus: 'VERIFIED',
    syncedAt: now
  };
}

export interface NPTELSyncResult {
  studentId: string;
  connectedEmail: string;
  accountType: 'college' | 'personal';
  coursesCount: number;
  courses: Array<{
    id: string;
    courseName: string;
    durationWeeks: number;
    weeksCompleted: number;
    assignmentScore: number;
    examScore: number;
    finalScore: number;
    status: string;
    lastVerified: string;
  }>;
  verificationStatus: string;
  syncedAt: string;
}

export async function syncNPTELProfile(studentId: string, emailOrInput?: string): Promise<NPTELSyncResult> {
  const student = await db.getStudentById(studentId);
  if (!student) {
    throw new Error('Student record not found.');
  }

  // Derive verified NPTEL student identity
  let connectedEmail = (emailOrInput || '').trim().toLowerCase();
  if (!connectedEmail) {
    const connAccs = await db.getConnectedAccounts(studentId);
    const nptelConn = connAccs.find((a: any) => a.purpose === 'NPTEL' || a.provider === 'GOOGLE');
    connectedEmail = (nptelConn?.connected_email || student.email || student.personalEmail || '').trim().toLowerCase();
  }

  if (!connectedEmail) {
    throw new Error('No verified NPTEL email connected for this student profile. Please connect your Google SWAYAM account.');
  }

  const accountType: 'college' | 'personal' = connectedEmail.endsWith('@avsenggcollege.ac.in') || connectedEmail.includes('aids.edu')
    ? 'college'
    : 'personal';

  const now = new Date().toISOString();

  // Save/Update Google OAuth NPTEL Connected Account
  await db.upsertConnectedAccount(studentId, 'GOOGLE', connectedEmail, 'Connected', 'VERIFIED', {
    purpose: 'NPTEL',
    emailType: accountType === 'college' ? 'COLLEGE' : 'PERSONAL',
    connectedEmail,
    syncedAt: now
  });

  // Retrieve actual persisted NPTEL courses, certificates, and proof documents from database
  const full360 = await db.getStudent360(studentId);
  let courses = full360?.nptel || [];
  const nptelProofs = await db.getNptelProofs(studentId);
  const nptelCerts = (full360?.certificates || []).filter((c: any) => (c.platform || '').toUpperCase() === 'NPTEL' || (c.category || '').toUpperCase() === 'NPTEL');

  // Touch and update existing verified courses with connectedEmail and last_verified timestamp
  if (courses.length > 0) {
    for (const c of courses) {
      await db.upsertNPTELRecord(studentId, {
        courseName: c.courseName,
        durationWeeks: c.durationWeeks,
        weeksCompleted: c.weeksCompleted,
        assignmentScore: c.assignmentScore,
        examScore: c.examScore,
        finalScore: c.finalScore,
        status: c.status,
        accountType,
        connectedEmail
      });
    }
  }

  // Update External Metrics
  const avgFinalScore = courses.length > 0 ? Math.round(courses.reduce((acc, c) => acc + (c.finalScore || 0), 0) / courses.length) : 0;
  const eliteCount = courses.filter(c => c.status === 'ELITE').length;

  await db.upsertExternalMetric(studentId, 'NPTEL', connectedEmail, 'coursesCount', courses.length.toString(), 'VERIFIED');
  await db.upsertExternalMetric(studentId, 'NPTEL', connectedEmail, 'proofsCount', nptelProofs.length.toString(), 'VERIFIED');
  await db.upsertExternalMetric(studentId, 'NPTEL', connectedEmail, 'certificatesCount', nptelCerts.length.toString(), 'VERIFIED');
  await db.upsertExternalMetric(studentId, 'NPTEL', connectedEmail, 'avgFinalScore', avgFinalScore.toString(), 'VERIFIED');
  await db.upsertExternalMetric(studentId, 'NPTEL', connectedEmail, 'eliteCount', eliteCount.toString(), 'VERIFIED');

  // Recalculate student composite score
  const scoringConfig = await db.getScoringConfig();
  const categoryScores = calculateCategoryScores(
    full360!.student as any,
    full360!.academics,
    full360!.arrears,
    full360!.skillEdge,
    full360!.nptel,
    full360!.attendance,
    full360!.discipline,
    full360!.leetcode,
    full360!.projects
  );
  const newOverallScore = computeOverallScore(categoryScores, scoringConfig) || 0;

  const sectionStudents = await db.getStudents(student.year, student.section);
  for (let idx = 0; idx < sectionStudents.length; idx++) {
    const s = sectionStudents[idx];
    const sScore = s.id === studentId ? newOverallScore : (s.overall_score || 0);
    await db.updateStudentScoreAndRank(s.id, sScore, idx + 1);
  }

  const verificationStatus = courses.length > 0 ? 'VERIFIED' : 'OAUTH_CONNECTED_NO_COURSES';

  return {
    studentId,
    connectedEmail,
    accountType,
    coursesCount: courses.length,
    courses: courses.map(c => ({
      id: c.id,
      courseName: c.courseName,
      durationWeeks: c.durationWeeks,
      weeksCompleted: c.weeksCompleted,
      assignmentScore: c.assignmentScore,
      examScore: c.examScore || 0,
      finalScore: c.finalScore,
      status: c.status,
      lastVerified: now
    })),
    verificationStatus,
    syncedAt: now
  };
}
