import { describe, expect, it } from 'vitest';

import { renderWithContext } from '@/test/render';

import { type HistoryRow, RecordHistoryTable } from './RecordHistoryTable';

const TABLE = 'Record history';

const renderTable = (rows: readonly HistoryRow[], whereHeader = 'Where') =>
  renderWithContext(
    <RecordHistoryTable
      rows={rows}
      whereHeader={whereHeader}
      ariaLabel={TABLE}
      testId="record-history"
      emptyMessage="Nothing recorded"
    />,
  );

describe(RecordHistoryTable, () => {
  it.each([
    { subject: 'a piece', whereHeader: 'Location' },
    { subject: 'an instrument', whereHeader: 'Where' },
  ])(
    'should head the table Dates, Nights, $whereHeader, Status, Note when it holds $subject',
    async ({ whereHeader }) => {
      const screen = await renderTable([], whereHeader);

      const table = screen.getByRole('table', { name: TABLE });
      await expect.element(table.getByRole('columnheader', { name: whereHeader })).toBeVisible();
      expect(
        table
          .getByRole('columnheader')
          .elements()
          .map((header) => header.textContent),
      ).toEqual(['Dates', 'Nights', whereHeader, 'Status', 'Note']);
    },
  );

  it('should put each record’s dates, nights, where, status and note in their own cells when it has rows', async () => {
    const screen = await renderTable([
      {
        id: 'out',
        dates: '15 Jul – 20 Aug 2026',
        nights: 37,
        where: 'Summit lab',
        status: { label: 'Unavailable', tone: 'alert' },
        note: 'Failed; removed for repair',
      },
      {
        id: 'in',
        dates: '1 Mar – 14 Jul 2026',
        nights: 136,
        where: 'Port 3 · GMOS-S',
        status: { label: 'Science', tone: 'normal' },
        note: null,
      },
    ]);

    const cellsOf = (row: string) =>
      screen
        .getByRole('row', { name: new RegExp(row) })
        .getByRole('cell')
        .elements()
        .map((cell) => cell.textContent);
    await expect.element(screen.getByRole('cell', { name: 'Failed; removed for repair' })).toBeVisible();
    expect(cellsOf('Summit lab')).toEqual([
      '15 Jul – 20 Aug 2026',
      '37',
      'Summit lab',
      'Unavailable',
      'Failed; removed for repair',
    ]);
    expect(cellsOf('GMOS-S')).toEqual(['1 Mar – 14 Jul 2026', '136', 'Port 3 · GMOS-S', 'Science', '']);
  });

  it('should show the empty message across one row when it has no rows', async () => {
    const screen = await renderTable([]);

    const message = screen.getByRole('cell', { name: 'Nothing recorded' });
    await expect.element(message).toBeVisible();
    await expect.element(message).toHaveAttribute('colspan', '5');
    expect(screen.getByRole('row').elements()).toHaveLength(2);
  });
});
