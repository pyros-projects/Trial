"""Validate supplied data and expected outcomes; these are not submission graders."""
import csv
import json
import unittest
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal
from pathlib import Path
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

ROOT = Path(__file__).resolve().parents[1]


def load(task, name):
    return json.loads((ROOT / 'prompts' / task / 'fixtures' / name).read_text(encoding='utf-8'))


class FixtureTests(unittest.TestCase):
    def test_import_fixture_rows_and_upsert_expected_state(self):
        folder = ROOT / 'prompts/21-import-studio/fixtures'
        with (folder / 'adversarial.csv').open(encoding='utf-8', newline='') as f:
            rows = list(csv.DictReader(f))
        self.assertEqual(len(rows), 6)
        self.assertEqual(sum(row['external_id'] == 'A005' for row in rows), 2)
        self.assertEqual(rows[1]['note'], 'Line one\nLine two')
        expected = load('21-import-studio', 'expected_after_commit.json')
        with (folder / 'cleaned.csv').open(encoding='utf-8', newline='') as f:
            cleaned = list(csv.DictReader(f))
        by_id = {row['external_id']: row for row in expected['catalog']}
        self.assertEqual(len(by_id), 5)
        self.assertEqual(len(cleaned), 4)
        for row in cleaned:
            actual = by_id[row['external_id']]
            self.assertEqual(actual['unit_price_cents'], int(Decimal(row['price']) * 100))
            self.assertEqual(actual['quantity'], int(row['quantity']))
            self.assertEqual(actual['active'], row['active'] in ('1', 'true'))
            self.assertEqual(actual['note'], row['note'])
        with (folder / 'decimal_comma.csv').open(encoding='utf-8', newline='') as f:
            special = next(csv.DictReader(f, delimiter=';'))
        self.assertEqual(special['external_id'], '0007')
        self.assertEqual(Decimal(special['price'].replace(',', '.')) * 100, 125)

    def test_recurrence_utc_expectations(self):
        data = load('22-resource-booker', 'recurrence_cases.json')
        try:
            tz = ZoneInfo(data['timezone'])
        except ZoneInfoNotFoundError:
            self.skipTest('System IANA timezone database unavailable; install tzdata for this fixture check.')
        for case in data['valid_weekly']:
            utc = datetime.fromisoformat(case['local_start']).replace(tzinfo=tz).astimezone(timezone.utc)
            self.assertEqual(utc.isoformat().replace('+00:00', 'Z'), case['expected_start_utc'])
        for case in data['reject']:
            local = datetime.fromisoformat(case['local'])
            candidates = set()
            for fold in (0, 1):
                utc = local.replace(tzinfo=tz, fold=fold).astimezone(timezone.utc)
                if utc.astimezone(tz).replace(tzinfo=None) == local:
                    candidates.add(utc)
            self.assertEqual(len(candidates), 0 if case['reason'] == 'nonexistent' else 2)

    def test_inventory_expected_ledger_balances(self):
        rows = load('23-stockroom', 'scenario.json')['expected_sequence']
        for row in rows:
            self.assertEqual(row['available'], row['physical'] - row['reserved'])
            self.assertGreaterEqual(min(row['physical'], row['reserved'], row['available']), 0)
        for left, right in ((rows[1], rows[2]), (rows[4], rows[5])):
            self.assertEqual({k: v for k, v in left.items() if k != 'after'},
                             {k: v for k, v in right.items() if k != 'after'})

    def test_workflow_fixture_is_a_valid_dag(self):
        graph = load('24-workflow-desk', 'example_workflow.json')
        nodes = {node['id'] for node in graph['nodes']}
        self.assertEqual(len(nodes), len(graph['nodes']))
        incoming = {node: set() for node in nodes}
        for edge in graph['edges']:
            self.assertIn(edge['from'], nodes)
            self.assertIn(edge['to'], nodes)
            incoming[edge['to']].add(edge['from'])
        ordered = set()
        while len(ordered) < len(nodes):
            ready = {node for node in nodes - ordered if incoming[node] <= ordered}
            self.assertTrue(ready, 'Fixture contains a cycle')
            ordered.update(ready)

    def test_merge_expected_independent_edits_and_resolutions(self):
        expected = load('26-config-workbench', 'expected.json')
        self.assertEqual(load('26-config-workbench', 'expected_conflicts.json'),
                         ['/service/description', '/service/limits/rate'])
        self.assertEqual(expected['service']['limits'], {'rate': 120, 'burst': 250})
        self.assertEqual(expected['service']['description'], 'public')
        self.assertTrue(expected['features']['beta'])
        self.assertEqual(expected['endpoints'], ['/health', '/metrics'])
        self.assertNotIn('description', load('26-config-workbench', 'left.json')['service'])
        self.assertIsNone(load('26-config-workbench', 'base.json')['service']['description'])

    def test_spreadsheet_arithmetic_expectations(self):
        cells = load('29-sheetcraft', 'workbook.json')['cells']
        expected = load('29-sheetcraft', 'expected.json')
        c1, c2 = cells['A1'] * cells['B1'], cells['A2'] * cells['B2']
        self.assertEqual(expected['values'], {'C1': c1, 'C2': c2, 'D1': c1 + c2,
                                            'E1': 10, 'F1': cells['A1'] + cells['B1'] + c1})
        self.assertEqual(expected['copy_F1_to_F2']['value'], cells['A2'] + cells['B1'] + c1)

    def test_planner_expected_schedules_and_calendar(self):
        project = load('30-project-planner', 'project.json')
        expected = load('30-project-planner', 'expected_schedule.json')
        tasks = {task['id']: task for task in project['tasks']}
        for variant in ('schedule', 'after_T1_duration_3'):
            schedule = expected[variant]
            for identifier, task in tasks.items():
                start, end = schedule[identifier]
                duration = 3 if variant != 'schedule' and identifier == 'T1' else task['duration']
                self.assertEqual(end - start, duration)
                for predecessor in task['predecessors']:
                    self.assertGreaterEqual(start, schedule[predecessor][1])
            for a, task in tasks.items():
                for b, other in tasks.items():
                    if a < b and task['resource_id'] and task['resource_id'] == other['resource_id']:
                        x, y = schedule[a], schedule[b]
                        self.assertTrue(x[1] <= y[0] or y[1] <= x[0])
        current = date.fromisoformat(project['start_date'])
        for _ in range(expected['resource_constrained_duration']):
            current += timedelta(days=1)
            while current.weekday() >= 5:
                current += timedelta(days=1)
        self.assertEqual(current.isoformat(), expected['completion_date'])
        earliest = {}
        for task in project['tasks']:
            earliest[task['id']] = max((earliest[p] for p in task['predecessors']), default=0) + task['duration']
        self.assertEqual(max(earliest.values()), expected['dependency_only_duration'])

    def test_public_scenarios_and_rubric_totals(self):
        catalog = json.loads((ROOT / 'prompts/catalog.json').read_text(encoding='utf-8'))
        for task in catalog[20:]:
            text = (ROOT / 'prompts' / task['id'] / 'acceptance.md').read_text(encoding='utf-8')
            self.assertEqual(text.count('**Exercise:**'), 6, task['id'])
            self.assertEqual(text.count('**Expected:**'), 6, task['id'])
        rubrics = json.loads((ROOT / 'evaluator/rubrics.json').read_text(encoding='utf-8'))
        for rubric in rubrics.values():
            self.assertEqual(sum(value for key, value in rubric.items() if key != 'track'), 100)
        sample = json.loads((ROOT / 'schema/example.metadata.json').read_text(encoding='utf-8'))
        for label, score in [('score', sample['score'])]:
            self.assertAlmostEqual(sum(v for k, v in score.items() if k != 'total'), score['total'])
            for dimension, maximum in rubrics['html-v1'].items():
                if dimension != 'track':
                    self.assertLessEqual(score[dimension], maximum, f'{label}.{dimension}')


if __name__ == '__main__':
    unittest.main()
