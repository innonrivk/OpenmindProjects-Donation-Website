// Background plugin to paint canvas background solid white before rendering
// Why? Ensures exported/downloaded PNG files are legible across dark and light image viewers.
export const backgroundPlugin = {
  id: 'customCanvasBackgroundColor',
  beforeDraw: (chart) => {
    const { ctx } = chart;
    ctx.save();
    ctx.globalCompositeOperation = 'destination-over';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, chart.width, chart.height);
    ctx.restore();
  }
};

// Custom plugin to draw exact donation values directly above point dots on chart lines
// Why? Fulfills the user request to visually display amounts without requiring hover interaction.
export const datalabelsPlugin = {
  id: 'datalabels',
  afterDatasetsDraw(chart) {
    const { ctx } = chart;
    ctx.save();

    chart.data.datasets.forEach((dataset, datasetIndex) => {
      const meta = chart.getDatasetMeta(datasetIndex);
      if (meta.hidden) return;

      meta.data.forEach((element, index) => {
        const value = dataset.data[index];
        // Skip zero values to keep the charts visually clean and clutter-free
        if (value === 0) return;

        const { x, y } = element.tooltipPosition();

        ctx.fillStyle = dataset.borderColor;
        ctx.font = '600 10px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'bottom';

        const formatted = new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
          maximumFractionDigits: 0,
        }).format(value);

        // Render white text glow shadow to guarantee text legibility on overlapping lines
        ctx.shadowColor = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowBlur = 4;
        ctx.fillText(formatted, x, y - 6);
      });
    });

    ctx.restore();
  }
};

/**
 * Builds Chart.js datasets from transaction analytics arrays.
 * 
 * @param {string[]} labels 
 * @param {number[]} monthlyAmounts 
 * @param {number[]} oneTimeAmounts 
 */
export const getChartData = (labels, monthlyAmounts, oneTimeAmounts) => ({
  labels,
  datasets: [
    {
      label: 'Monthly Donations',
      data: monthlyAmounts,
      borderColor: '#4285f4', // Brand blue
      backgroundColor: 'rgba(66, 133, 244, 0.04)',
      tension: 0.3,
      borderWidth: 3,
      pointBackgroundColor: '#4285f4',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 1.5,
      pointHoverRadius: 7,
      pointRadius: 4,
      fill: true,
    },
    {
      label: 'One-Time Donations',
      data: oneTimeAmounts,
      borderColor: '#34a853', // Brand green
      backgroundColor: 'rgba(52, 168, 83, 0.04)',
      tension: 0.3,
      borderWidth: 3,
      pointBackgroundColor: '#34a853',
      pointBorderColor: '#ffffff',
      pointBorderWidth: 1.5,
      pointHoverRadius: 7,
      pointRadius: 4,
      fill: true,
    },
  ],
});

/**
 * Generates options configuration object for the line chart.
 * 
 * Why? Ensures y-axis always starts exactly at 0 (never negative) and dynamically computes the maximum
 * limit with 15% headroom to prevent datalabels from clipping at the top.
 * 
 * @param {function} onDrillDown - Drilldown callback from shell.
 * @param {number[]} monthlyAmounts - Monthly donation data series.
 * @param {number[]} oneTimeAmounts - One-time donation data series.
 */
export const getChartOptions = (onDrillDown, monthlyAmounts = [], oneTimeAmounts = []) => {
  const maxVal = Math.max(...monthlyAmounts, ...oneTimeAmounts, 10);
  const yMax = Math.ceil(maxVal * 1.15);

  return {
    responsive: true,
    maintainAspectRatio: false,
    cursor: 'pointer',
    interaction: {
      mode: 'index',
      intersect: false,
    },
    plugins: {
      legend: {
        position: 'top',
        labels: {
          font: { family: "'Inter', sans-serif", size: 12, weight: '600' },
          color: 'var(--color-text-secondary)',
          boxWidth: 16,
          padding: 20,
        },
      },
      tooltip: {
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        titleColor: 'var(--brand-dark)',
        bodyColor: 'var(--color-text-secondary)',
        borderColor: 'var(--color-border)',
        borderWidth: 1,
        padding: 12,
        boxPadding: 6,
        cornerRadius: 8,
        titleFont: { family: "'Inter', sans-serif", size: 13, weight: '700' },
        bodyFont: { family: "'Inter', sans-serif", size: 12 },
        callbacks: {
          label: (context) => {
            let label = context.dataset.label || '';
            if (label) label += ': ';
            if (context.parsed.y !== null) {
              label += new Intl.NumberFormat('en-US', {
                style: 'currency',
                currency: 'USD',
              }).format(context.parsed.y);
            }
            return label;
          },
        },
      },
    },
    scales: {
      x: {
        grid: { display: false },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 11 },
          color: 'var(--color-text-muted)',
        },
      },
      y: {
        min: 0,
        max: yMax,
        border: { dash: [5, 5] },
        grid: { color: 'rgba(0, 0, 0, 0.05)' },
        ticks: {
          font: { family: "'Inter', sans-serif", size: 11 },
          color: 'var(--color-text-muted)',
          callback: (value) => `$${value.toLocaleString()}`,
        },
      },
    },
    onClick: (event, elements, chart) => {
      if (elements.length > 0) {
        const index = elements[0].index;
        const periodLabel = chart.data.labels[index];

        let startISO = null;
        let endISO = null;

        if (periodLabel.includes('-')) {
          const [yearStr, monthStr] = periodLabel.split('-');
          const year = parseInt(yearStr, 10);
          const month = parseInt(monthStr, 10) - 1;
          startISO = new Date(Date.UTC(year, month, 1, 0, 0, 0, 0)).toISOString();
          endISO = new Date(Date.UTC(year, month + 1, 0, 23, 59, 59, 999)).toISOString();
        } else {
          const year = parseInt(periodLabel, 10);
          startISO = new Date(Date.UTC(year, 0, 1, 0, 0, 0, 0)).toISOString();
          endISO = new Date(Date.UTC(year, 11, 31, 23, 59, 59, 999)).toISOString();
        }

        onDrillDown({ start: startISO, end: endISO, label: periodLabel });
      }
    },
  };
};
