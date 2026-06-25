/**
 * Dynamically generates a high-definition SVG line chart displaying monthly or yearly donation trends.
 *
 * Why? Sandboxed browser iframe environments often block canvas base64 image captures or strip
 * download extensions. Generating the vector image on the backend guarantees 100% reliable image exports.
 * Uses SVG filters to create a soft text shadow glow, ensuring labels remain legible over lines.
 *
 * @param {Array<{period: string, monthly: number, oneTime: number}>} data - Raw aggregated transaction series.
 * @param {'MONTHLY' | 'YEARLY'} view - Active timeline perspective.
 * @returns {string} Fully structured SVG text document.
 */
export function generateSvgChart(data, view) {
  const n = data.length;
  const width = 800;
  const height = 450;
  const paddingLeft = 70;
  const paddingRight = 40;
  const paddingTop = 65;
  const paddingBottom = 65;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  const maxVal = Math.max(...data.map((d) => Math.max(d.monthly, d.oneTime)), 100);
  const yMax = Math.ceil(maxVal * 1.15); // Add 15% top scale headroom

  // 1. Render horizontal grid lines and Y-axis text
  let gridLinesHtml = '';
  for (let i = 0; i <= 4; i++) {
    const yVal = yMax * (i / 4);
    const yPos = height - paddingBottom - (yVal / yMax) * chartHeight;
    gridLinesHtml += `
      <line x1="${paddingLeft}" y1="${yPos}" x2="${width - paddingRight}" y2="${yPos}" stroke="#dadce0" stroke-width="1" stroke-dasharray="5,5"/>
      <text x="${paddingLeft - 10}" y="${yPos + 4}" text-anchor="end" font-family="'Inter', sans-serif" font-size="11" fill="#80868b">$${Math.round(yVal).toLocaleString()}</text>
    `;
  }

  // 2. Render X-axis date labels
  let xLabelsHtml = '';
  for (let i = 0; i < n; i++) {
    const xPos = paddingLeft + i * (chartWidth / (n - 1));
    xLabelsHtml += `
      <text x="${xPos}" y="${height - paddingBottom + 22}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="10" fill="#80868b">${data[i].period}</text>
    `;
  }

  // 3. Compile coordinate maps
  const getX = (i) => paddingLeft + i * (chartWidth / (n - 1));
  const getY = (val) => height - paddingBottom - (val / yMax) * chartHeight;

  const monthlyPoints = data.map((d, i) => ({ x: getX(i), y: getY(d.monthly), val: d.monthly }));
  const oneTimePoints = data.map((d, i) => ({ x: getX(i), y: getY(d.oneTime), val: d.oneTime }));

  const monthlyLinePath = monthlyPoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const monthlyFillPath = `${monthlyLinePath} L ${monthlyPoints[n - 1].x.toFixed(1)} ${(height - paddingBottom).toFixed(1)} L ${monthlyPoints[0].x.toFixed(1)} ${(height - paddingBottom).toFixed(1)} Z`;

  const oneTimeLinePath = oneTimePoints.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const oneTimeFillPath = `${oneTimeLinePath} L ${oneTimePoints[n - 1].x.toFixed(1)} ${(height - paddingBottom).toFixed(1)} L ${oneTimePoints[0].x.toFixed(1)} ${(height - paddingBottom).toFixed(1)} Z`;

  // 4. Render markers (circle dots) and values overlay
  let monthlyMarkersHtml = '';
  let oneTimeMarkersHtml = '';

  monthlyPoints.forEach((p) => {
    monthlyMarkersHtml += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#4285f4" stroke="#ffffff" stroke-width="1.5"/>`;
    if (p.val > 0) {
      monthlyMarkersHtml += `
        <text x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="10" font-weight="600" fill="#4285f4" filter="url(#glow)">$${Math.round(p.val).toLocaleString()}</text>
      `;
    }
  });

  oneTimePoints.forEach((p) => {
    oneTimeMarkersHtml += `<circle cx="${p.x.toFixed(1)}" cy="${p.y.toFixed(1)}" r="4.5" fill="#34a853" stroke="#ffffff" stroke-width="1.5"/>`;
    if (p.val > 0) {
      oneTimeMarkersHtml += `
        <text x="${p.x.toFixed(1)}" y="${(p.y - 8).toFixed(1)}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="10" font-weight="600" fill="#34a853" filter="url(#glow)">$${Math.round(p.val).toLocaleString()}</text>
      `;
    }
  });

  // Assemble full vector markup
  return `<?xml version="1.0" encoding="UTF-8" standalone="no"?>
<svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Soft glow mask to separate overlapping overlay values from lines -->
    <filter id="glow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="1.8" result="blur" />
      <feColorMatrix type="matrix" values="1 0 0 0 1  0 1 0 0 1  0 0 1 0 1  0 0 0 0.9 0" result="glowColor"/>
      <feMerge>
        <feMergeNode in="glowColor" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  </defs>

  <!-- Solid Canvas Background -->
  <rect width="${width}" height="${height}" fill="#ffffff"/>

  <!-- Main Chart Heading -->
  <text x="${width / 2}" y="32" text-anchor="middle" font-family="'Inter', sans-serif" font-size="16" font-weight="700" fill="#202124">Donation Trends (${view === 'MONTHLY' ? 'Last 12 Months' : 'Last 10 Years'})</text>

  <!-- Centered Legend Group -->
  <g transform="translate(${width / 2 - 150}, 46)">
    <line x1="0" y1="6" x2="20" y2="6" stroke="#4285f4" stroke-width="3"/>
    <circle cx="10" cy="6" r="3.5" fill="#4285f4" stroke="#ffffff" stroke-width="1"/>
    <text x="26" y="10" font-family="'Inter', sans-serif" font-size="11" font-weight="600" fill="#5f6368">Monthly Donations</text>

    <line x1="160" y1="6" x2="180" y2="6" stroke="#34a853" stroke-width="3"/>
    <circle cx="170" cy="6" r="3.5" fill="#34a853" stroke="#ffffff" stroke-width="1"/>
    <text x="186" y="10" font-family="'Inter', sans-serif" font-size="11" font-weight="600" fill="#5f6368">One-Time Donations</text>
  </g>

  <!-- Grids -->
  <g>${gridLinesHtml}</g>

  <!-- Timelines Axis -->
  <g>${xLabelsHtml}</g>

  <!-- Shaded Regions -->
  <path d="${monthlyFillPath}" fill="rgba(66, 133, 244, 0.03)" stroke="none"/>
  <path d="${oneTimeFillPath}" fill="rgba(52, 168, 83, 0.03)" stroke="none"/>

  <!-- Dataset Lines -->
  <path d="${monthlyLinePath}" fill="none" stroke="#4285f4" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="${oneTimeLinePath}" fill="none" stroke="#34a853" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>

  <!-- Markers & Labels -->
  <g>${monthlyMarkersHtml}</g>
  <g>${oneTimeMarkersHtml}</g>
</svg>`;
}
