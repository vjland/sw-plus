// Initialize Lucide icons
lucide.createIcons();

// State
let appMode = 'simu'; // 'simu' | 'live'
let activeTab = 'chart'; // 'chart' | 'log'

let simuLogs = [];
let simuChartData = [];

let liveLogs = [];
let liveChartData = [];

let isPanelOpen = false;
let autoHide = false;
let liveScoreInput = "";
let showMA = false;
let maPeriod = 9;

// DOM Elements
const btnModeSimu = document.getElementById('btn-mode-simu');
const btnModeLive = document.getElementById('btn-mode-live');
const nextBetIndicator = document.getElementById('next-bet-indicator');
const btnSimuRefresh = document.getElementById('btn-simu-refresh');
const btnLivePanelToggle = document.getElementById('btn-live-panel-toggle');
const liveInputPanel = document.getElementById('live-input-panel');
const btnMaToggle = document.getElementById('btn-ma-toggle');
const maToggleDot = document.getElementById('ma-toggle-dot');
const chartContainer = document.getElementById('chart-container');

const liveScoreP = document.getElementById('live-score-p');
const liveScoreB = document.getElementById('live-score-b');
const keypadContainer = document.getElementById('keypad-container');
const checkboxAutoHide = document.getElementById('autoHide');

const btnLiveConfirm = document.getElementById('btn-live-confirm');
const btnLiveUndo = document.getElementById('btn-live-undo');
const btnLiveReset = document.getElementById('btn-live-reset');

const tabChart = document.getElementById('tab-chart');
const tabLog = document.getElementById('tab-log');
const logTbody = document.getElementById('log-tbody');

const btnTabChart = document.getElementById('btn-tab-chart');
const btnTabLog = document.getElementById('btn-tab-log');

const resetModal = document.getElementById('reset-modal');
const btnResetCancel = document.getElementById('btn-reset-cancel');
const btnResetConfirm = document.getElementById('btn-reset-confirm');

const bottomNav = document.getElementById('bottom-nav');

// Chart Setup
const ctx = document.getElementById('myChart').getContext('2d');
const labels = Array.from({ length: 80 }, (_, i) => i + 1);
const chart = new Chart(ctx, {
  type: 'line',
  data: {
    labels,
    datasets: [{
      label: 'Running Sum',
      data: [],
      borderColor: '#0EA5E9',
      backgroundColor: 'rgba(14, 165, 233, 0.1)',
      borderWidth: 2,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 4,
      pointBackgroundColor: '#0EA5E9',
    }, {
      label: 'MA(9)',
      data: [],
      borderColor: '#3b82f6',
      backgroundColor: 'transparent',
      borderWidth: 1,
      tension: 0.1,
      pointRadius: 0,
      pointHoverRadius: 0,
      hidden: true
    }]
  },
  options: {
    responsive: true,
    maintainAspectRatio: false,
    layout: { padding: 0 },
    scales: {
      x: {
        min: 0, max: 79,
        title: { display: false },
        grid: { display: false },
        ticks: { color: '#A1A1AA' }
      },
      y: {
        min: -20, max: 20,
        title: { display: false },
        grid: { 
          display: true, 
          color: '#18181b',
          drawTicks: false
        },
        ticks: { 
          color: '#A1A1AA',
          stepSize: 2
        }
      }
    },
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          title: (context) => 'Hand ' + context[0].label,
          label: (context) => 'Running Sum: ' + context.raw
        }
      },
      zoom: {
        pan: {
          enabled: true,
          mode: 'y',
        },
        limits: {
          y: { min: -40, max: 40 }
        }
      }
    }
  }
});

// Baccarat Logic
const createShoe = (numDecks) => {
  const suits = ['♠', '♥', '♦', '♣'];
  const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
  const values = { 'A': 1, '2': 2, '3': 3, '4': 4, '5': 5, '6': 6, '7': 7, '8': 8, '9': 9, '10': 0, 'J': 0, 'Q': 0, 'K': 0 };
  let shoe = [];
  for (let i = 0; i < numDecks; i++) {
    for (const suit of suits) {
      for (const rank of ranks) {
        shoe.push({ suit, rank, value: values[rank] });
      }
    }
  }
  for (let i = shoe.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shoe[i], shoe[j]] = [shoe[j], shoe[i]];
  }
  return shoe;
};

const getHandValue = (cards) => {
  return cards.reduce((sum, card) => sum + card.value, 0) % 10;
};

const dealHand = (shoe) => {
  if (shoe.length < 6) return null;
  const player = [shoe.pop()];
  const banker = [shoe.pop()];
  player.push(shoe.pop());
  banker.push(shoe.pop());

  let playerValue = getHandValue(player);
  let bankerValue = getHandValue(banker);

  let playerDrew = false;
  let playerThirdCard = null;

  if (playerValue >= 8 || bankerValue >= 8) {
    // Natural, both stand
  } else {
    if (playerValue <= 5) {
      playerThirdCard = shoe.pop();
      player.push(playerThirdCard);
      playerValue = getHandValue(player);
      playerDrew = true;
    }

    if (!playerDrew) {
      if (bankerValue <= 5) {
        banker.push(shoe.pop());
        bankerValue = getHandValue(banker);
      }
    } else {
      const p3 = playerThirdCard.value;
      let bankerDraws = false;
      if (bankerValue <= 2) bankerDraws = true;
      else if (bankerValue === 3 && p3 !== 8) bankerDraws = true;
      else if (bankerValue === 4 && p3 >= 2 && p3 <= 7) bankerDraws = true;
      else if (bankerValue === 5 && p3 >= 4 && p3 <= 7) bankerDraws = true;
      else if (bankerValue === 6 && (p3 === 6 || p3 === 7)) bankerDraws = true;

      if (bankerDraws) {
        banker.push(shoe.pop());
        bankerValue = getHandValue(banker);
      }
    }
  }

  let winner = 'Tie';
  if (playerValue > bankerValue) winner = 'Player';
  else if (bankerValue > playerValue) winner = 'Banker';

  return {
    player, banker, playerValue, bankerValue, winner,
    isNatural: player.length === 2 && banker.length === 2
  };
};

const simulate = () => {
  const shoe = createShoe(8);
  const cutCardIndex = 14;
  let runningSum = 0;
  let nextBet = null;
  let handNumber = 1;
  const logs = [];
  const chartData = [];

  while (shoe.length > cutCardIndex && handNumber <= 80) {
    const result = dealHand(shoe);
    if (!result) break;

    let betResult = 'No Bet';
    let betPlaced = nextBet;

    if (nextBet) {
      if (result.winner === 'Tie') betResult = 'Push';
      else if (result.winner === nextBet) { betResult = 'Win'; runningSum += 1; }
      else { betResult = 'Loss'; runningSum -= 1; }
    }

    logs.push({
      handNumber, player: result.player, banker: result.banker,
      playerValue: result.playerValue, bankerValue: result.bankerValue,
      winner: result.winner, isNatural: result.isNatural,
      betPlaced, betResult, runningSum
    });

    if (result.winner !== 'Tie') chartData.push(runningSum);

    if (result.winner !== 'Tie') {
      const winnerScore = result.winner === 'Player' ? result.playerValue : result.bankerValue;
      const loserScore = result.winner === 'Player' ? result.bankerValue : result.playerValue;
      const isStrongWin = winnerScore >= 7;
      const isWeakLoss = loserScore <= 1;
      
      if (isStrongWin || isWeakLoss) {
        nextBet = result.winner;
      } else {
        nextBet = result.winner === 'Player' ? 'Banker' : 'Player';
      }
    }

    handNumber++;
  }
  return { logs, chartData };
};

const getNextBet = (logs) => {
  for (let i = logs.length - 1; i >= 0; i--) {
    const log = logs[i];
    if (log.winner !== 'Tie') {
      const winnerScore = log.winner === 'Player' ? log.playerValue : log.bankerValue;
      const loserScore = log.winner === 'Player' ? log.bankerValue : log.playerValue;
      const isStrongWin = winnerScore >= 7;
      const isWeakLoss = loserScore <= 1;
      
      if (isStrongWin || isWeakLoss) {
        return log.winner;
      } else {
        return log.winner === 'Player' ? 'Banker' : 'Player';
      }
    }
  }
  return null;
};

const calculateMA = (data, period) => {
  const ma = [];
  for (let i = 0; i < data.length; i++) {
    if (i < period) {
      ma.push(null);
    } else {
      const slice = data.slice(i - period + 1, i + 1);
      const sum = slice.reduce((a, b) => a + b, 0);
      ma.push(sum / period);
    }
  }
  return ma;
};

// UI Updates
const updateUI = () => {
  const currentLogs = appMode === 'simu' ? simuLogs : liveLogs;
  const currentChartData = appMode === 'simu' ? simuChartData : liveChartData;
  const nextUpcomingBet = getNextBet(currentLogs);

  // Update Chart
  const color = appMode === 'simu' ? '#0EA5E9' : '#EAB308';
  const maColor = appMode === 'simu' ? '#3b82f6' : '#00f2ff';
  const chartBg = appMode === 'simu' ? '#09090b' : '#1e212b';
  
  chartContainer.style.backgroundColor = chartBg;
  
  chart.data.datasets[0].data = currentChartData;
  chart.data.datasets[0].borderColor = color;
  chart.data.datasets[0].backgroundColor = color;
  
  chart.data.datasets[1].label = `MA(${maPeriod})`;
  chart.data.datasets[1].data = calculateMA(currentChartData, maPeriod);
  chart.data.datasets[1].borderColor = maColor;
  chart.data.datasets[1].hidden = !showMA;
  
  chart.update();

  // Update MA Period Buttons
  const btnMa6 = document.getElementById('btn-ma-period-6');
  const btnMa9 = document.getElementById('btn-ma-period-9');
  if (maPeriod === 6) {
    btnMa6.classList.add('bg-blue-600', 'text-white');
    btnMa6.classList.remove('text-zinc-500', 'hover:text-zinc-300');
    btnMa9.classList.remove('bg-blue-600', 'text-white');
    btnMa9.classList.add('text-zinc-500', 'hover:text-zinc-300');
  } else {
    btnMa9.classList.add('bg-blue-600', 'text-white');
    btnMa9.classList.remove('text-zinc-500', 'hover:text-zinc-300');
    btnMa6.classList.remove('bg-blue-600', 'text-white');
    btnMa6.classList.add('text-zinc-500', 'hover:text-zinc-300');
  }

  // Update MA Toggle UI
  if (showMA) {
    btnMaToggle.classList.remove('bg-zinc-700');
    btnMaToggle.classList.add('bg-blue-500');
    maToggleDot.classList.remove('translate-x-0');
    maToggleDot.classList.add('translate-x-5');
  } else {
    btnMaToggle.classList.remove('bg-blue-500');
    btnMaToggle.classList.add('bg-zinc-700');
    maToggleDot.classList.remove('translate-x-5');
    maToggleDot.classList.add('translate-x-0');
  }

  // Update Next Bet Indicator
  if (appMode === 'live' && nextUpcomingBet) {
    nextBetIndicator.classList.remove('hidden');
    nextBetIndicator.textContent = nextUpcomingBet.charAt(0);
    if (nextUpcomingBet === 'Banker') {
      nextBetIndicator.className = 'flex items-center justify-center w-8 h-8 rounded border-2 font-bold text-sm border-red-500 text-red-500';
    } else {
      nextBetIndicator.className = 'flex items-center justify-center w-8 h-8 rounded border-2 font-bold text-sm border-blue-500 text-blue-500';
    }
  } else {
    nextBetIndicator.classList.add('hidden');
  }

  // Update Log Table
  logTbody.innerHTML = '';
  const reversedLogs = [...currentLogs].reverse();
  reversedLogs.forEach(log => {
    const tr = document.createElement('tr');
    tr.className = 'hover:bg-zinc-800/30 transition-colors';
    
    const scoreStr = log.playerValue !== undefined ? `${log.playerValue}-${log.bankerValue}` : '-';
    
    let winColor = 'text-green-400';
    if (log.winner === 'Player') winColor = 'text-blue-400';
    else if (log.winner === 'Banker') winColor = 'text-red-400';

    let winType = '';
    if (log.winner !== 'Tie' && log.playerValue !== undefined) {
      const winnerScore = log.winner === 'Player' ? log.playerValue : log.bankerValue;
      const loserScore = log.winner === 'Player' ? log.bankerValue : log.playerValue;
      if (winnerScore >= 7) winType = '(S)';
      else if (loserScore <= 1) winType = '(W)';
    }

    let betClass = 'text-blue-200/50';
    if (log.betResult === 'Win') betClass = 'bg-green-500/20 text-green-400';
    else if (log.betResult === 'Loss') betClass = 'bg-red-500/20 text-red-400';
    else if (log.betResult === 'Push') betClass = 'bg-[#D53E0F]/20 text-[#D53E0F]';

    let sumColor = 'text-zinc-100';
    let sumPrefix = '';
    if (log.runningSum > 0) { sumColor = 'text-green-400'; sumPrefix = '+'; }
    else if (log.runningSum < 0) { sumColor = 'text-red-400'; }

    tr.innerHTML = `
      <td class="px-2 py-3 text-zinc-100">${log.handNumber}</td>
      <td class="px-2 py-3">${scoreStr}</td>
      <td class="px-2 py-3 font-medium ${winColor}">${log.winner.charAt(0)}${winType}</td>
      <td class="px-2 py-3">
        <span class="inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${betClass}">
          ${log.betPlaced ? log.betPlaced.charAt(0) : '-'}
        </span>
      </td>
      <td class="px-2 py-3 font-bold ${sumColor}">${sumPrefix}${log.runningSum}</td>
    `;
    logTbody.appendChild(tr);
  });

  // Update Live Panel Buttons State
  if (appMode === 'live') {
    btnLiveConfirm.disabled = liveScoreInput.length !== 2;
    btnLiveUndo.disabled = liveLogs.length === 0;
    btnLiveReset.disabled = liveLogs.length === 0;

    liveScoreP.textContent = liveScoreInput[0] || "-";
    liveScoreB.textContent = liveScoreInput[1] || "-";
  }
};

const setMode = (mode) => {
  appMode = mode;
  const liveCalculator = document.getElementById('live-calculator');
  if (mode === 'simu') {
    btnModeSimu.className = 'px-3 py-1 rounded-md text-sm font-medium transition-colors bg-[#D53E0F] text-zinc-950 shadow-[0_0_10px_rgba(213,62,15,0.5)]';
    btnModeLive.className = 'px-3 py-1 rounded-md text-sm font-medium transition-colors text-zinc-400 hover:text-zinc-100';
    btnSimuRefresh.classList.remove('hidden');
    btnLivePanelToggle.classList.add('hidden');
    liveInputPanel.classList.add('hidden');
    liveCalculator.classList.add('hidden');
    bottomNav.classList.remove('hidden');
    isPanelOpen = false;
  } else {
    btnModeLive.className = 'px-3 py-1 rounded-md text-sm font-medium transition-colors bg-live-500 text-zinc-950';
    btnModeSimu.className = 'px-3 py-1 rounded-md text-sm font-medium transition-colors text-zinc-400 hover:text-zinc-100';
    btnSimuRefresh.classList.add('hidden');
    btnLivePanelToggle.classList.remove('hidden');
    liveCalculator.classList.remove('hidden');
    bottomNav.classList.add('hidden');
    if (isPanelOpen) liveInputPanel.classList.remove('hidden');
  }
  updateUI();
  setTab(activeTab);
};

const setTab = (tab) => {
  activeTab = tab;
  const activeColor = appMode === 'live' ? 'text-live-500 bg-live-500/10' : 'text-[#D53E0F] bg-[#D53E0F]/10 shadow-[inset_0_0_10px_rgba(213,62,15,0.2)]';
  const inactiveColor = 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50';

  if (tab === 'chart') {
    btnTabChart.className = `flex-1 py-3 flex items-center justify-center rounded-lg transition-colors ${activeColor}`;
    btnTabLog.className = `flex-1 py-3 flex items-center justify-center rounded-lg transition-colors ${inactiveColor}`;
    tabChart.classList.remove('opacity-0', 'pointer-events-none');
    tabChart.classList.add('opacity-100', 'z-10');
    tabLog.classList.remove('opacity-100', 'z-10');
    tabLog.classList.add('opacity-0', 'pointer-events-none');
  } else {
    btnTabLog.className = `flex-1 py-3 flex items-center justify-center rounded-lg transition-colors ${activeColor}`;
    btnTabChart.className = `flex-1 py-3 flex items-center justify-center rounded-lg transition-colors ${inactiveColor}`;
    tabLog.classList.remove('opacity-0', 'pointer-events-none');
    tabLog.classList.add('opacity-100', 'z-10');
    tabChart.classList.remove('opacity-100', 'z-10');
    tabChart.classList.add('opacity-0', 'pointer-events-none');
  }
};

// Event Listeners
btnModeSimu.addEventListener('click', () => setMode('simu'));
btnModeLive.addEventListener('click', () => setMode('live'));

btnTabChart.addEventListener('click', () => setTab('chart'));
btnTabLog.addEventListener('click', () => setTab('log'));

btnMaToggle.addEventListener('click', () => {
  showMA = !showMA;
  updateUI();
});

document.getElementById('btn-ma-period-6').addEventListener('click', () => {
  maPeriod = 6;
  updateUI();
});

document.getElementById('btn-ma-period-9').addEventListener('click', () => {
  maPeriod = 9;
  updateUI();
});

document.getElementById('btn-chart-download').addEventListener('click', () => {
  const link = document.createElement('a');
  link.download = `baccarat-chart-${appMode}.png`;
  link.href = chart.toBase64Image();
  link.click();
});

btnSimuRefresh.addEventListener('click', () => {
  const { logs, chartData } = simulate();
  simuLogs = logs;
  simuChartData = chartData;
  updateUI();
});

btnLivePanelToggle.addEventListener('click', () => {
  isPanelOpen = !isPanelOpen;
  if (isPanelOpen) {
    liveInputPanel.classList.remove('hidden');
    btnLivePanelToggle.className = 'p-2 rounded-lg transition-colors shadow-sm bg-live-600 text-zinc-950';
  } else {
    liveInputPanel.classList.add('hidden');
    btnLivePanelToggle.className = 'p-2 rounded-lg transition-colors shadow-sm bg-live-500 hover:bg-live-600 text-zinc-950';
  }
});

const initKeypad = () => {
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'C', '0', '⌫'];
  keypadContainer.innerHTML = '';
  keys.forEach(key => {
    const btn = document.createElement('button');
    btn.className = 'aspect-square flex items-center justify-center rounded-lg text-xl font-bold border border-zinc-700 text-zinc-400 hover:bg-zinc-800/50 transition-colors';
    btn.textContent = key;
    btn.addEventListener('click', () => {
      if (key === 'C') {
        liveScoreInput = '';
      } else if (key === '⌫') {
        liveScoreInput = liveScoreInput.slice(0, -1);
      } else {
        if (liveScoreInput.length < 2) {
          liveScoreInput += key;
        }
      }
      updateUI();
    });
    keypadContainer.appendChild(btn);
  });
};
initKeypad();

checkboxAutoHide.addEventListener('change', (e) => { autoHide = e.target.checked; });

btnLiveConfirm.addEventListener('click', () => {
  if (liveScoreInput.length !== 2) return;

  const pScore = parseInt(liveScoreInput[0], 10);
  const bScore = parseInt(liveScoreInput[1], 10);
  
  let winner = 'Tie';
  if (pScore > bScore) winner = 'Player';
  else if (bScore > pScore) winner = 'Banker';

  const isNatural = pScore >= 8 || bScore >= 8;

  const handNumber = liveLogs.length + 1;
  const nextBet = getNextBet(liveLogs);
  let runningSum = liveLogs.length > 0 ? liveLogs[liveLogs.length - 1].runningSum : 0;
  
  let betResult = 'No Bet';
  if (nextBet) {
    if (winner === 'Tie') betResult = 'Push';
    else if (winner === nextBet) { betResult = 'Win'; runningSum += 1; }
    else { betResult = 'Loss'; runningSum -= 1; }
  }

  liveLogs.push({
    handNumber, winner, isNatural,
    playerValue: pScore, bankerValue: bScore,
    betPlaced: nextBet, betResult, runningSum
  });

  liveChartData = liveLogs.filter(l => l.winner !== 'Tie').map(l => l.runningSum);

  liveScoreInput = '';

  if (autoHide) {
    isPanelOpen = false;
    liveInputPanel.classList.add('hidden');
    btnLivePanelToggle.className = 'p-2 rounded-lg transition-colors shadow-sm bg-live-500 hover:bg-live-600 text-zinc-950';
  }

  updateUI();
});

btnLiveUndo.addEventListener('click', () => {
  if (liveLogs.length === 0) return;
  liveLogs.pop();
  liveChartData = liveLogs.filter(l => l.winner !== 'Tie').map(l => l.runningSum);
  updateUI();
});

btnLiveReset.addEventListener('click', () => {
  resetModal.classList.remove('hidden');
});

btnResetCancel.addEventListener('click', () => {
  resetModal.classList.add('hidden');
});

btnResetConfirm.addEventListener('click', () => {
  liveLogs = [];
  liveChartData = [];
  liveScoreInput = '';
  resetModal.classList.add('hidden');
  updateUI();
});

// Initial run
const { logs, chartData } = simulate();
simuLogs = logs;
simuChartData = chartData;
updateUI();
