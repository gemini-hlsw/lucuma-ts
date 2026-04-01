import { round } from '@gemini-hlsw/lucuma-common-ui';
import { Title } from '@Shared/Title/Title';

export function GuidersDetails() {
  const GUIDERS_VALUES = [
    {
      name: 'PWFS1',
      x: 0,
      y: 0,
      r: 0,
      x_max: 50,
      x_min: 0,
      y_max: 50,
      y_min: 0,
      r_max: 50,
      r_min: 0,
    },
    {
      name: 'PWFS2',
      x: 103,
      y: 0,
      r: 0,
      x_max: 50,
      x_min: 0,
      y_max: 50,
      y_min: 0,
      r_max: 50,
      r_min: 0,
    },
  ];

  const rows = GUIDERS_VALUES.map((row) => (
    <div className="row" key={`guiders-row-${row.name}`}>
      <span>{row.name}</span>
      <span className={row.x > row.x_max || row.x < row.x_min ? 'vals error' : 'vals'}>{round(row.x, 2)}</span>
      <span className={row.y > row.y_max || row.y < row.y_min ? 'vals error' : 'vals'}>{round(row.y, 2)}</span>
      <span className={row.r > row.r_max || row.r < row.r_min ? 'vals error' : 'vals'}>{round(row.r, 2)}</span>
    </div>
  ));

  return (
    <div className="guiders-details">
      <Title title="Guiders" />
      <div className="body">
        <div className="row">
          <span>Name</span>
          <span className="vals">X</span>
          <span className="vals">Y</span>
          <span className="vals">R</span>
        </div>
        {rows}
      </div>
    </div>
  );
}
