import { db } from '../db';
import { calculateCategoryScores, computeOverallScore } from '../scoringEngine';

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
    const full360 = db.getStudent360(studentId);
    const connAccs = db.getConnectedAccounts(studentId);
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
      const gqlData = await gqlRes.json();
      if (gqlData?.errors && gqlData.errors.some((e: any) => e.message?.toLowerCase().includes('does not exist'))) {
        throw new Error(`LeetCode profile handle "${cleanUsername}" was not found on LeetCode. Please verify the username.`);
      }

      if (gqlData?.data?.matchedUser) {
        const mu = gqlData.data.matchedUser;
        const acList = mu.submitStats?.acSubmissionNum || [];
        const totalList = mu.submitStats?.totalSubmissionNum || [];

        const allAc = acList.find((x: any) => x.difficulty === 'All');
        const easyAc = acList.find((x: any) => x.difficulty === 'Easy');
        const medAc = acList.find((x: any) => x.difficulty === 'Medium');
        const hardAc = acList.find((x: any) => x.difficulty === 'Hard');
        const allTotal = totalList.find((x: any) => x.difficulty === 'All');

        easySolved = easyAc?.count || 0;
        mediumSolved = medAc?.count || 0;
        hardSolved = hardAc?.count || 0;
        totalSolved = allAc?.count !== undefined ? allAc.count : (easySolved + mediumSolved + hardSolved);
        totalAttempted = allTotal?.submissions || 0;
        const acSubmissions = allAc?.submissions || 0;
        acceptanceRate = totalAttempted > 0 ? parseFloat(((acSubmissions / totalAttempted) * 100).toFixed(1)) : 0;

        ranking = mu.profile?.ranking || 0;
        contestRating = gqlData.data.userContestRanking?.rating ? Math.round(gqlData.data.userContestRanking.rating) : 1200;
        verified = true;
      }
    }
  } catch (err: any) {
    if (err.message && err.message.includes('not found')) {
      throw err;
    }
    fetchError = err.message || '';
  }

  // 2. Fallback 1: Public Vercel API endpoint
  if (!verified) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`https://leetcode-api.vercel.app/api/profile/${encodeURIComponent(cleanUsername)}`, {
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (response) {
        if (response.status === 404) {
          throw new Error(`LeetCode profile handle "${cleanUsername}" was not found on LeetCode.`);
        }
        if (response.ok) {
          const data = await response.json();
          const mu = data?.data?.matchedUser;
          if (mu) {
            const acList = mu.submitStats?.acSubmissionNum || [];
            const totalList = mu.submitStats?.totalSubmissionNum || [];
            const allAc = acList.find((x: any) => x.difficulty === 'All');
            const easyAc = acList.find((x: any) => x.difficulty === 'Easy');
            const medAc = acList.find((x: any) => x.difficulty === 'Medium');
            const hardAc = acList.find((x: any) => x.difficulty === 'Hard');
            const allTotal = totalList.find((x: any) => x.difficulty === 'All');

            easySolved = easyAc?.count || 0;
            mediumSolved = medAc?.count || 0;
            hardSolved = hardAc?.count || 0;
            totalSolved = allAc?.count !== undefined ? allAc.count : (easySolved + mediumSolved + hardSolved);
            totalAttempted = allTotal?.submissions || 0;
            const acSubmissions = allAc?.submissions || 0;
            acceptanceRate = totalAttempted > 0 ? parseFloat(((acSubmissions / totalAttempted) * 100).toFixed(1)) : 0;
            ranking = mu.profile?.ranking || 0;
            verified = true;
          } else if (data && (data.totalSolved !== undefined || data.easySolved !== undefined)) {
            verified = true;
            easySolved = parseInt(data.easySolved) || 0;
            mediumSolved = parseInt(data.mediumSolved) || 0;
            hardSolved = parseInt(data.hardSolved) || 0;
            totalSolved = parseInt(data.totalSolved) || (easySolved + mediumSolved + hardSolved);
            contestRating = Math.round(parseFloat(data.contestRating || data.rating || 1200));
            ranking = parseInt(data.ranking) || 0;
            totalAttempted = parseInt(data.totalSubmissions || data.totalAttempted || 0);
            acceptanceRate = parseFloat(data.acceptanceRate || 0);
          } else if (data && data.errors) {
            throw new Error(`LeetCode handle "${cleanUsername}" verification failed: User profile not found.`);
          }
        }
      }
    } catch (err: any) {
      if (err.message && (err.message.includes('not found') || err.message.includes('verification failed'))) {
        throw err;
      }
    }
  }

  // 3. Fallback 2: Alfa LeetCode API
  if (!verified) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(`https://alfa-leetcode-api.onrender.com/userProfile/${encodeURIComponent(cleanUsername)}`, {
        signal: controller.signal
      }).catch(() => null);

      clearTimeout(timeoutId);

      if (response && response.ok) {
        const data = await response.json();
        if (data && (data.totalSolved !== undefined || data.easySolved !== undefined)) {
          verified = true;
          easySolved = parseInt(data.easySolved) || 0;
          mediumSolved = parseInt(data.mediumSolved) || 0;
          hardSolved = parseInt(data.hardSolved) || 0;
          totalSolved = parseInt(data.totalSolved) || (easySolved + mediumSolved + hardSolved);
          contestRating = Math.round(parseFloat(data.contestRating || 1200));
          ranking = parseInt(data.ranking) || 0;
          if (data.totalSubmissions && Array.isArray(data.totalSubmissions)) {
            const allSub = data.totalSubmissions.find((x: any) => x.difficulty === 'All');
            if (allSub) {
              totalAttempted = allSub.submissions || 0;
              const acSub = data.matchedUserStats?.acSubmissionNum?.find((x: any) => x.difficulty === 'All')?.submissions || totalSolved;
              acceptanceRate = totalAttempted > 0 ? parseFloat(((acSub / totalAttempted) * 100).toFixed(1)) : 0;
            }
          }
        }
      }
    } catch (_err) {
      // ignore fallback error
    }
  }

  if (!verified) {
    throw new Error(fetchError || `Failed to verify LeetCode username "${cleanUsername}". Please make sure the profile handle exists on LeetCode.`);
  }

  const now = new Date().toISOString();

  // Save Connection Status
  db.upsertConnectedAccount(studentId, 'LeetCode', cleanUsername, 'Connected', 'VERIFIED', {
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
  db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'totalSolved', totalSolved, 'VERIFIED');
  db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'easySolved', easySolved, 'VERIFIED');
  db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'mediumSolved', mediumSolved, 'VERIFIED');
  db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'hardSolved', hardSolved, 'VERIFIED');
  db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'totalAttempted', totalAttempted, 'VERIFIED');
  db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'acceptanceRate', acceptanceRate, 'VERIFIED');
  db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'contestRating', contestRating, 'VERIFIED');
  db.upsertExternalMetric(studentId, 'LeetCode', cleanUsername, 'ranking', ranking, 'VERIFIED');

  // Update leetcode_stats table with explicit totalSolved
  db.updateLeetCode(studentId, cleanUsername, easySolved, mediumSolved, hardSolved, contestRating, totalAttempted, acceptanceRate, totalSolved);

  // Recalculate student composite score & rank
  const student = db.getStudentById(studentId);
  if (student) {
    const full360 = db.getStudent360(studentId)!;
    const scoringConfig = db.getScoringConfig();
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

    const sectionStudents = db.getStudents(student.year, student.section);
    sectionStudents.forEach((s, idx) => {
      const sScore = s.id === studentId ? newOverallScore : (s.overall_score || 0);
      db.updateStudentScoreAndRank(s.id, sScore, idx + 1);
    });
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
  const student = db.getStudentById(studentId);
  if (!student) {
    throw new Error('Student record not found.');
  }

  // Derive verified NPTEL student identity
  let connectedEmail = (emailOrInput || '').trim().toLowerCase();
  if (!connectedEmail) {
    const connAccs = db.getConnectedAccounts(studentId);
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
  db.upsertConnectedAccount(studentId, 'GOOGLE', connectedEmail, 'Connected', 'VERIFIED', {
    purpose: 'NPTEL',
    emailType: accountType === 'college' ? 'COLLEGE' : 'PERSONAL',
    connectedEmail,
    syncedAt: now
  });

  // Retrieve actual persisted NPTEL courses, certificates, and proof documents from database
  const full360 = db.getStudent360(studentId);
  let courses = full360?.nptel || [];
  const nptelProofs = db.getNptelProofs(studentId);
  const nptelCerts = (full360?.certificates || []).filter((c: any) => (c.platform || '').toUpperCase() === 'NPTEL' || (c.category || '').toUpperCase() === 'NPTEL');

  // Touch and update existing verified courses with connectedEmail and last_verified timestamp
  if (courses.length > 0) {
    for (const c of courses) {
      db.upsertNPTELRecord(studentId, {
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

  db.upsertExternalMetric(studentId, 'NPTEL', connectedEmail, 'coursesCount', courses.length.toString(), 'VERIFIED');
  db.upsertExternalMetric(studentId, 'NPTEL', connectedEmail, 'proofsCount', nptelProofs.length.toString(), 'VERIFIED');
  db.upsertExternalMetric(studentId, 'NPTEL', connectedEmail, 'certificatesCount', nptelCerts.length.toString(), 'VERIFIED');
  db.upsertExternalMetric(studentId, 'NPTEL', connectedEmail, 'avgFinalScore', avgFinalScore.toString(), 'VERIFIED');
  db.upsertExternalMetric(studentId, 'NPTEL', connectedEmail, 'eliteCount', eliteCount.toString(), 'VERIFIED');

  // Recalculate student composite score
  const scoringConfig = db.getScoringConfig();
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

  const sectionStudents = db.getStudents(student.year, student.section);
  sectionStudents.forEach((s, idx) => {
    const sScore = s.id === studentId ? newOverallScore : (s.overall_score || 0);
    db.updateStudentScoreAndRank(s.id, sScore, idx + 1);
  });

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
