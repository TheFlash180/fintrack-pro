import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import type { MonthPoint } from '../lib/aggregate';
import { fmtMonthShort, fmtZar } from '../lib/format';

// Series colors validated for the dark surface (dataviz six checks):
const INCOME = '#2fbfa8';
const EXPENSE = '#a78bfa';
const GRID = '#2f3643';
const AXIS_TEXT = '#a3abbb';

export function IncomeExpenseChart({ data }: { data: MonthPoint[] }) {
  const chartData = data.map((p) => ({
    month: fmtMonthShort(p.ym),
    Income: Number(p.income.toFixed(2)),
    Expenses: Number(p.expenses.toFixed(2)),
  }));
  const hasAny = data.some((p) => p.income > 0 || p.expenses > 0);
  if (!hasAny) {
    return <div className="empty-state">Nothing to chart yet — import a statement to begin.</div>;
  }

  return (
    <div style={{ width: '100%', height: 220 }}>
      <ResponsiveContainer>
        <BarChart data={chartData} barGap={2} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
          <CartesianGrid stroke={GRID} strokeDasharray="3 3" vertical={false} />
          <XAxis
            dataKey="month"
            tick={{ fill: AXIS_TEXT, fontSize: 11, fontFamily: 'Manrope' }}
            axisLine={{ stroke: GRID }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: AXIS_TEXT, fontSize: 10, fontFamily: 'IBM Plex Mono' }}
            tickFormatter={(v: number) => (v >= 1000 ? `${Math.round(v / 1000)}k` : String(v))}
            axisLine={false}
            tickLine={false}
            width={38}
          />
          <Tooltip
            cursor={{ fill: 'rgba(255,255,255,0.04)' }}
            contentStyle={{
              background: '#232833',
              border: '1px solid #2f3643',
              borderRadius: 10,
              fontFamily: 'IBM Plex Mono',
              fontSize: 12,
            }}
            labelStyle={{ color: '#eef0f5', fontFamily: 'Manrope', fontWeight: 600 }}
            formatter={(value: number) => fmtZar(value)}
          />
          <Legend
            wrapperStyle={{ fontSize: 12, fontFamily: 'Manrope' }}
            iconType="circle"
            iconSize={9}
          />
          <Bar dataKey="Income" fill={INCOME} radius={[4, 4, 0, 0]} maxBarSize={26} />
          <Bar dataKey="Expenses" fill={EXPENSE} radius={[4, 4, 0, 0]} maxBarSize={26} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
