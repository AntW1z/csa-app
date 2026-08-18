import { View, Text, StyleSheet } from 'react-native';
import Svg, { Path, Circle } from 'react-native-svg';
import { spacing, colors } from '../theme';

export interface PieSlice {
  label: string;
  value: number;
  color: string;
}

const DEFAULT_SIZE = 140;

function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}

// Wedge from startAngle to endAngle (degrees, 0 = top, clockwise) as an SVG
// path — the standard "move to center, line to edge, arc to other edge,
// close" construction for a pie slice.
function describeWedge(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const largeArcFlag = endAngle - startAngle > 180 ? 1 : 0;
  return `M ${cx} ${cy} L ${start.x} ${start.y} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x} ${end.y} Z`;
}

// A plain pie (not a donut). Zero-value slices are skipped when drawing
// (an arc of 0° draws nothing anyway) but still listed in the legend, so
// e.g. an event with no 4th-years still shows "4: 0" rather than omitting
// the category entirely.
export default function PieChart({ data, size = DEFAULT_SIZE }: { data: PieSlice[]; size?: number }) {
  const total = data.reduce((sum, d) => sum + d.value, 0);
  const r = size / 2;
  const nonZero = data.filter((d) => d.value > 0);
  let cumulativeAngle = 0;

  return (
    <View style={styles.row}>
      <Svg width={size} height={size}>
        {total === 0 ? (
          <Circle cx={r} cy={r} r={r} fill={colors.border} />
        ) : nonZero.length === 1 ? (
          // A single slice spanning the full circle degenerates to a
          // zero-length arc if drawn as a wedge path — a plain filled
          // circle sidesteps that instead of fighting the math.
          <Circle cx={r} cy={r} r={r} fill={nonZero[0].color} />
        ) : (
          nonZero.map((d) => {
            const angle = (d.value / total) * 360;
            const path = describeWedge(r, r, r, cumulativeAngle, cumulativeAngle + angle);
            cumulativeAngle += angle;
            return <Path key={d.label} d={path} fill={d.color} />;
          })
        )}
      </Svg>
      <View style={styles.legend}>
        {data.map((d) => (
          <View key={d.label} style={styles.legendRow}>
            <View style={[styles.swatch, { backgroundColor: d.color }]} />
            <Text style={styles.legendText}>
              {d.label}: {d.value}
              {total > 0 ? ` (${Math.round((d.value / total) * 100)}%)` : ''}
            </Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  legend: { gap: spacing.xs, flexShrink: 1 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 10, height: 10, borderRadius: 2 },
  legendText: { fontSize: 12, color: colors.textSecondary },
});
