document.addEventListener('DOMContentLoaded', function() {
    const ctx = document.getElementById('predictionChart').getContext('2d');

    // Dữ liệu mô phỏng dự báo giá
    const years = ['2024', '2025', '2026', '2027', '2028'];
    const basePrice = [115, 118, 122, 125, 128]; // Giá nếu không có hạ tầng mới
    const aiPredictedPrice = [115, 125, 140, 165, 175]; // Giá tăng vọt khi Metro và Nút giao hoàn thành

    const gradientBlue = ctx.createLinearGradient(0, 0, 0, 200);
    gradientBlue.addColorStop(0, 'rgba(37, 99, 235, 0.2)');   // --primary-color
    gradientBlue.addColorStop(1, 'rgba(37, 99, 235, 0)');

    new Chart(ctx, {
        type: 'line',
        data: {
            labels: years,
            datasets: [
                {
                    label: 'Dự báo AI (Có hạ tầng)',
                    data: aiPredictedPrice,
                    borderColor: '#2563eb', // --primary-color
                    backgroundColor: gradientBlue,
                    borderWidth: 3,
                    pointBackgroundColor: '#2563eb',
                    pointBorderColor: '#ffffff',
                    pointBorderWidth: 2,
                    pointRadius: 4,
                    fill: true,
                    tension: 0.4
                },
                {
                    label: 'Tăng trưởng tự nhiên',
                    data: basePrice,
                    borderColor: '#cbd5e1',
                    borderWidth: 2,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false,
                    tension: 0.4
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: {
                        usePointStyle: true,
                        boxWidth: 8,
                        font: {
                            family: 'Inter',
                            size: 11
                        }
                    }
                },
                tooltip: {
                    backgroundColor: '#1e293b',
                    titleFont: { family: 'Inter', size: 13 },
                    bodyFont: { family: 'Inter', size: 12 },
                    padding: 10,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return context.raw + ' triệu/m²';
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    min: 100,
                    grid: {
                        color: '#f1f5f9',
                        drawBorder: false,
                    },
                    ticks: {
                        font: { family: 'Inter', size: 10 },
                        color: '#94a3b8',
                        callback: function(value) {
                            return value + 'tr';
                        }
                    }
                },
                x: {
                    grid: {
                        display: false,
                        drawBorder: false,
                    },
                    ticks: {
                        font: { family: 'Inter', size: 10 },
                        color: '#94a3b8'
                    }
                }
            },
            interaction: {
                intersect: false,
                mode: 'index',
            },
        }
    });
});
