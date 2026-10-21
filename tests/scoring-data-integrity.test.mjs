import assert from 'node:assert/strict';
import { test } from 'node:test';
import { isolateServer } from './helpers/isolated-server.mjs';

isolateServer({ getTeams: async () => [], getRepresentativeEvaluation: async () => null });
const scoring = await import('../server/scoringEngine.ts');
const skilledge = await import('../server/services/skilledgeSync.ts');

test('missing academic and LeetCode evidence does not receive synthetic score defaults', async () => {
  const breakdown = scoring.calculateCategoryScores(
    { cgpa: null }, [], [], undefined, [], undefined, [], undefined, []
  );
  assert.equal(breakdown.academic, 0);
  assert.equal(scoring.computeLeetCodeAwardScore({ totalSolved: 0 }), 0);
  assert.equal(await scoring.computeTeamHeadScore(
    { id: 'student-fixture', cgpa: null, overall_score: 0 }, []
  ), 0);
  assert.equal(await scoring.computeRepresentativeScore(
    { id: 'student-fixture', is_representative: true, cgpa: null }, 100
  ), 0);
});

test('SkillEdge levels without source evidence remain unknown', () => {
  const assessments = skilledge.generateSkillEdgeAssessments();
  assert.ok(assessments.length > 0);
  assert.ok(assessments.every(area => area.levels.every(level => level.status === 'Unknown')));
});

test('SkillEdge normalization preserves known states without inventing absent levels', () => {
  const assessments = skilledge.generateSkillEdgeAssessments([{
    areaName: 'C',
    levels: [{ levelNumber: 1, status: 'Cleared' }, { levelNumber: 2, status: 'Not Cleared' }]
  }]);
  const cLevels = assessments.find(area => area.areaName === 'C').levels;
  assert.deepEqual(cLevels.slice(0, 3).map(level => level.status), ['Cleared', 'Not Cleared', 'Unknown']);
  assert.ok(assessments.find(area => area.areaName === 'Python').levels.every(level => level.status === 'Unknown'));
});
