export interface SparklinePoint {
  x: number;
  y: number;
}
export interface SparklineResult {
  points: SparklinePoint[];
  line: string;
  area: string;
}

/** 데이터를 width×height 박스의 SVG 좌표로 매핑. y는 위가 0(SVG 관례). */
export function buildSparkline(
  data: number[],
  width: number,
  height: number,
  pad = 2,
): SparklineResult {
  if (data.length === 0) return { points: [], line: "", area: "" };

  const max = Math.max(...data);
  const min = Math.min(...data);
  const span = max - min || 1;
  const innerH = height - pad * 2;
  const step = data.length === 1 ? 0 : width / (data.length - 1);

  const points = data.map((v, i) => ({
    x: data.length === 1 ? 0 : Math.round(i * step),
    y: Math.round(pad + innerH - ((v - min) / span) * innerH),
  }));

  const line = points
    .map((p, i) => `${i === 0 ? "M" : "L"}${p.x} ${p.y}`)
    .join(" ");

  const first = points[0];
  const last = points[points.length - 1];
  const area =
    first != null && last != null
      ? `${line} L${last.x} ${height} L${first.x} ${height} Z`
      : "";

  return { points, line, area };
}
