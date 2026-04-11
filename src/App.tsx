/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useMemo } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
} from "chart.js";
import zoomPlugin from "chartjs-plugin-zoom";
import { RefreshCw, LineChart, List, Pencil, Download } from "lucide-react";
import "./components/BaccaratCalculator";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  zoomPlugin,
);

type Card = { suit: string; rank: string; value: number };

const createShoe = (numDecks: number): Card[] => {
  const suits = ["♠", "♥", "♦", "♣"];
  const ranks = [
    "A",
    "2",
    "3",
    "4",
    "5",
    "6",
    "7",
    "8",
    "9",
    "10",
    "J",
    "Q",
    "K",
  ];
  const values: Record<string, number> = {
    A: 1,
    "2": 2,
    "3": 3,
    "4": 4,
    "5": 5,
    "6": 6,
    "7": 7,
    "8": 8,
    "9": 9,
    "10": 0,
    J: 0,
    Q: 0,
    K: 0,
  };

  let shoe: Card[] = [];
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

const getHandValue = (cards: Card[]): number => {
  return cards.reduce((sum, card) => sum + card.value, 0) % 10;
};

type HandResult = {
  player: Card[];
  banker: Card[];
  playerValue: number;
  bankerValue: number;
  winner: "Player" | "Banker" | "Tie";
  isNatural: boolean;
};

const dealHand = (shoe: Card[]): HandResult | null => {
  if (shoe.length < 6) return null;

  const player: Card[] = [shoe.pop()!];
  const banker: Card[] = [shoe.pop()!];
  player.push(shoe.pop()!);
  banker.push(shoe.pop()!);

  let playerValue = getHandValue(player);
  let bankerValue = getHandValue(banker);

  let playerDrew = false;
  let playerThirdCard: Card | null = null;

  if (playerValue >= 8 || bankerValue >= 8) {
    // Natural, both stand
  } else {
    if (playerValue <= 5) {
      playerThirdCard = shoe.pop()!;
      player.push(playerThirdCard);
      playerValue = getHandValue(player);
      playerDrew = true;
    }

    if (!playerDrew) {
      if (bankerValue <= 5) {
        banker.push(shoe.pop()!);
        bankerValue = getHandValue(banker);
      }
    } else {
      const p3 = playerThirdCard!.value;
      let bankerDraws = false;
      if (bankerValue <= 2) bankerDraws = true;
      else if (bankerValue === 3 && p3 !== 8) bankerDraws = true;
      else if (bankerValue === 4 && p3 >= 2 && p3 <= 7) bankerDraws = true;
      else if (bankerValue === 5 && p3 >= 4 && p3 <= 7) bankerDraws = true;
      else if (bankerValue === 6 && (p3 === 6 || p3 === 7)) bankerDraws = true;

      if (bankerDraws) {
        banker.push(shoe.pop()!);
        bankerValue = getHandValue(banker);
      }
    }
  }

  let winner: "Player" | "Banker" | "Tie" = "Tie";
  if (playerValue > bankerValue) winner = "Player";
  else if (bankerValue > playerValue) winner = "Banker";

  return {
    player,
    banker,
    playerValue,
    bankerValue,
    winner,
    isNatural: player.length === 2 && banker.length === 2,
  };
};

type LogEntry = {
  handNumber: number;
  player?: Card[];
  banker?: Card[];
  playerValue?: number;
  bankerValue?: number;
  winner: "Player" | "Banker" | "Tie";
  isNatural: boolean;
  betPlaced: "Player" | "Banker" | null;
  betResult: "Win" | "Loss" | "Push" | "No Bet";
  runningSum: number;
};

const simulate = () => {
  const shoe = createShoe(8);
  const cutCardIndex = 14;

  let runningSum = 0;
  let nextBet: "Player" | "Banker" | null = null;
  let handNumber = 1;
  const logs: LogEntry[] = [];
  const chartData: number[] = [];

  while (shoe.length > cutCardIndex && handNumber <= 80) {
    const result = dealHand(shoe);
    if (!result) break;

    let betResult: "Win" | "Loss" | "Push" | "No Bet" = "No Bet";
    let betPlaced = nextBet;

    if (nextBet) {
      if (result.winner === "Tie") {
        betResult = "Push";
      } else if (result.winner === nextBet) {
        betResult = "Win";
        runningSum += 1;
      } else {
        betResult = "Loss";
        runningSum -= 1;
      }
    }

    logs.push({
      handNumber,
      player: result.player,
      banker: result.banker,
      playerValue: result.playerValue,
      bankerValue: result.bankerValue,
      winner: result.winner,
      isNatural: result.isNatural,
      betPlaced,
      betResult,
      runningSum,
    });

    // Exclude ties from the performance chart
    if (result.winner !== "Tie") {
      chartData.push(runningSum);
    }

    if (result.winner !== "Tie") {
      const winnerScore = result.winner === "Player" ? result.playerValue : result.bankerValue;
      const loserScore = result.winner === "Player" ? result.bankerValue : result.playerValue;

      const isStreak = winnerScore >= 8 || (winnerScore - loserScore === 1) || loserScore === 0;

      if (isStreak) {
        nextBet = result.winner;
      } else {
        nextBet = result.winner === "Player" ? "Banker" : "Player";
      }
    }

    handNumber++;
  }

  return { logs, chartData };
};

const calculateMA = (data: number[], period: number) => {
  const ma: (number | null)[] = [];
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

const BigRoad = ({ logs }: { logs: LogEntry[] }) => {
  const { grid, maxCol } = useMemo(() => {
    const grid: Record<string, { winner: string; ties: number }> = {};
    let currentCol = 0;
    let currentRow = 0;
    let startCol = 0;
    let lastWinner: string | null = null;
    let pendingTies = 0;
    let maxCol = 0;

    for (const log of logs) {
      if (log.winner === "Tie") {
        if (lastWinner === null) {
          pendingTies++;
        } else {
          grid[`${currentCol},${currentRow}`].ties++;
        }
        continue;
      }

      if (lastWinner === null) {
        lastWinner = log.winner;
        currentCol = 0;
        currentRow = 0;
        startCol = 0;
        grid[`${currentCol},${currentRow}`] = {
          winner: log.winner,
          ties: pendingTies,
        };
        pendingTies = 0;
      } else if (log.winner === lastWinner) {
        let nextRow = currentRow + 1;
        let nextCol = currentCol;

        if (currentCol > startCol) {
          nextRow = currentRow;
          nextCol = currentCol + 1;
        } else if (nextRow >= 6 || grid[`${nextCol},${nextRow}`]) {
          nextRow = currentRow;
          nextCol = currentCol + 1;
        }

        while (grid[`${nextCol},${nextRow}`]) {
          nextCol++;
        }

        currentCol = nextCol;
        currentRow = nextRow;
        grid[`${currentCol},${currentRow}`] = { winner: log.winner, ties: 0 };
      } else {
        lastWinner = log.winner;
        startCol++;
        while (grid[`${startCol},0`]) {
          startCol++;
        }
        currentCol = startCol;
        currentRow = 0;
        grid[`${currentCol},${currentRow}`] = { winner: log.winner, ties: 0 };
      }

      if (currentCol > maxCol) maxCol = currentCol;
    }

    return { grid, maxCol };
  }, [logs]);

  const cols = Math.max(24, maxCol + 2);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [grid, cols]);

  return (
    <div
      ref={scrollRef}
      className="h-full overflow-x-auto overflow-y-hidden bg-zinc-950 p-1 custom-scrollbar"
    >
      <div className="flex flex-col h-full w-max gap-[1px] bg-zinc-800 border border-zinc-800">
        {[0, 1, 2, 3, 4, 5].map((row) => (
          <div key={row} className="flex flex-1 gap-[1px]">
            {Array.from({ length: cols }).map((_, col) => {
              const cell = grid[`${col},${row}`];
              return (
                <div
                  key={col}
                  className="h-full aspect-square bg-zinc-950 relative flex items-center justify-center"
                >
                  {cell && (
                    <div
                      className={`w-[75%] h-[75%] rounded-full border-[2px] ${
                        cell.winner === "Player"
                          ? "border-blue-500"
                          : "border-red-500"
                      } flex items-center justify-center relative`}
                    >
                      {cell.ties > 0 && (
                        <div className="absolute w-[140%] h-[2px] bg-green-500 -rotate-45 z-10"></div>
                      )}
                      {cell.ties > 1 && (
                        <span className="text-[9px] text-green-500 font-bold z-20 bg-zinc-950/80 rounded-full px-0.5 leading-none">
                          {cell.ties}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
};

export default function App() {
  const [appMode, setAppMode] = useState<"simu" | "live">("simu");
  const [activeTab, setActiveTab] = useState<"chart" | "log" | "strategy">("chart");
  const [showBigRoad, setShowBigRoad] = useState(true);
  const [maPeriod, setMaPeriod] = useState<0 | 6 | 9>(0);
  const chartRef = useRef<any>(null);

  // Simu state
  const [simuLogs, setSimuLogs] = useState<LogEntry[]>([]);
  const [simuChartData, setSimuChartData] = useState<number[]>([]);

  // Live state
  const [liveLogs, setLiveLogs] = useState<LogEntry[]>([]);
  const [liveChartData, setLiveChartData] = useState<number[]>([]);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [autoHide, setAutoHide] = useState(false);
  const [liveScoreInput, setLiveScoreInput] = useState<string>("");
  const [isResetConfirmOpen, setIsResetConfirmOpen] = useState(false);

  const runSimulation = () => {
    const { logs: newLogs, chartData: newChartData } = simulate();
    setSimuLogs(newLogs);
    setSimuChartData(newChartData);
  };

  useEffect(() => {
    runSimulation();
  }, []);

  const getNextBet = (logs: LogEntry[]): "Player" | "Banker" | null => {
    for (let i = logs.length - 1; i >= 0; i--) {
      if (logs[i].winner !== "Tie") {
        const pScore = logs[i].playerValue!;
        const bScore = logs[i].bankerValue!;
        const winnerScore = logs[i].winner === "Player" ? pScore : bScore;
        const loserScore = logs[i].winner === "Player" ? bScore : pScore;

        const isStreak = winnerScore >= 8 || (winnerScore - loserScore === 1) || loserScore === 0;

        if (isStreak) return logs[i].winner as "Player" | "Banker";
        return logs[i].winner === "Player" ? "Banker" : "Player";
      }
    }
    return null;
  };

  const handleLiveConfirm = () => {
    if ('vibrate' in navigator) navigator.vibrate(50);
    if (liveScoreInput.length !== 2) return;

    const pScore = parseInt(liveScoreInput[0], 10);
    const bScore = parseInt(liveScoreInput[1], 10);

    let liveWinner: "Player" | "Banker" | "Tie" = "Tie";
    if (pScore > bScore) liveWinner = "Player";
    else if (bScore > pScore) liveWinner = "Banker";

    const handNumber = liveLogs.length + 1;
    const nextBet = getNextBet(liveLogs);
    let runningSum =
      liveLogs.length > 0 ? liveLogs[liveLogs.length - 1].runningSum : 0;

    let betResult: "Win" | "Loss" | "Push" | "No Bet" = "No Bet";
    if (nextBet) {
      if (liveWinner === "Tie") {
        betResult = "Push";
      } else if (liveWinner === nextBet) {
        betResult = "Win";
        runningSum += 1;
      } else {
        betResult = "Loss";
        runningSum -= 1;
      }
    }

    const newLog: LogEntry = {
      handNumber,
      playerValue: pScore,
      bankerValue: bScore,
      winner: liveWinner,
      isNatural: false,
      betPlaced: nextBet,
      betResult,
      runningSum,
    };

    const newLogs = [...liveLogs, newLog];
    setLiveLogs(newLogs);

    const newChartData = newLogs
      .filter((l) => l.winner !== "Tie")
      .map((l) => l.runningSum);
    setLiveChartData(newChartData);

    setLiveScoreInput("");

    if (autoHide) {
      setIsPanelOpen(false);
    }
  };

  const handleLiveUndo = () => {
    if ('vibrate' in navigator) navigator.vibrate(50);
    if (liveLogs.length === 0) return;
    const newLogs = liveLogs.slice(0, -1);
    setLiveLogs(newLogs);
    const newChartData = newLogs
      .filter((l) => l.winner !== "Tie")
      .map((l) => l.runningSum);
    setLiveChartData(newChartData);
  };

  const handleLiveReset = () => {
    setIsResetConfirmOpen(true);
  };

  const confirmReset = () => {
    setLiveLogs([]);
    setLiveChartData([]);
    setLiveScoreInput("");
    setIsResetConfirmOpen(false);
  };

  const currentLogs = appMode === "simu" ? simuLogs : liveLogs;
  const handleDownloadChart = () => {
    if (chartRef.current) {
      const link = document.createElement("a");
      link.download = `baccarat-chart-${appMode}.png`;
      link.href = chartRef.current.toBase64Image();
      link.click();
    }
  };

  const currentChartData = appMode === "simu" ? simuChartData : liveChartData;
  const nextUpcomingBet = getNextBet(currentLogs);

  const labels = Array.from({ length: 80 }, (_, i) => i + 1);

  const data = {
    labels,
    datasets: [
      {
        label: "Running Sum",
        data: currentChartData,
        borderColor: appMode === "simu" ? "#0EA5E9" : "#4DCCBD",
        backgroundColor:
          appMode === "simu"
            ? "rgba(14, 165, 233, 0.1)"
            : "rgba(77, 204, 189, 0.1)",
        borderWidth: 2,
        tension: 0.1,
        pointRadius: 0,
        pointHoverRadius: 4,
        pointBackgroundColor: appMode === "simu" ? "#0EA5E9" : "#4DCCBD",
      },
      ...(maPeriod > 0
        ? [
            {
              label: `MA(${maPeriod})`,
              data: calculateMA(currentChartData, maPeriod),
              borderColor: appMode === "simu" ? "#FFA69E" : "#D1D646",
              backgroundColor: "transparent",
              borderWidth: 1,
              tension: 0.1,
              pointRadius: 0,
              pointHoverRadius: 0,
            },
          ]
        : []),
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    layout: {
      padding: 0,
    },
    scales: {
      x: {
        min: 0,
        max: 79,
        title: { display: false },
        grid: {
          display: false,
        },
        ticks: { color: "#A1A1AA" },
      },
      y: {
        min: -20,
        max: 20,
        title: { display: false },
        grid: {
          display: true,
          color: "#18181b",
          drawTicks: false,
        },
        ticks: {
          color: "#A1A1AA",
          stepSize: 2,
        },
      },
    },
    plugins: {
      legend: {
        display: false,
      },
      tooltip: {
        callbacks: {
          title: (context: any) => `Hand ${context[0].label}`,
          label: (context: any) => `Running Sum: ${context.raw}`,
        },
      },
      zoom: {
        pan: {
          enabled: true,
          mode: "y" as const,
        },
        limits: {
          y: { min: -40, max: 40 },
        },
      },
    },
  };

  return (
    <div className="h-[100dvh] w-full flex flex-col bg-zinc-950 text-zinc-100 font-sans overflow-hidden">
      {/* Header */}
      <div className="flex-none flex justify-between items-center p-4 bg-zinc-900 border-b border-zinc-800 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <div className="flex items-center justify-center w-10 h-10 bg-zinc-950 rounded-xl border border-zinc-800 shadow-sm flex-shrink-0">
            <span className="text-xl font-black italic tracking-wider text-zinc-100">SW</span>
          </div>
          <div className="flex items-center bg-zinc-950 p-1 rounded-lg border border-zinc-800">
            <button
              onClick={() => setAppMode("simu")}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${appMode === "simu" ? "bg-[#0EA5E9] text-zinc-950 shadow-[0_0_10px_rgba(14,165,233,0.5)]" : "text-zinc-400 hover:text-zinc-100"}`}
            >
              Simu
            </button>
            <button
              onClick={() => {
                setAppMode("live");
                setActiveTab("chart");
              }}
              className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${appMode === "live" ? "bg-live-500 text-zinc-950" : "text-zinc-400 hover:text-zinc-100"}`}
            >
              Live
            </button>
          </div>

          {appMode === "live" && nextUpcomingBet && (
            <div
              className={`flex items-center justify-center w-8 h-8 rounded border-2 font-bold text-sm ${
                nextUpcomingBet === "Banker"
                  ? "border-red-500 text-red-500"
                  : "border-blue-500 text-blue-500"
              }`}
            >
              {nextUpcomingBet.charAt(0)}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {appMode === "simu" ? (
            <button
              onClick={runSimulation}
              className="p-2 bg-[#0EA5E9] hover:bg-[#0284C7] text-zinc-950 rounded-lg transition-colors shadow-[0_0_10px_rgba(14,165,233,0.5)]"
              title="Simulate New Shoe"
            >
              <RefreshCw className="w-5 h-5" />
            </button>
          ) : (
            <button
              onClick={() => setIsPanelOpen(!isPanelOpen)}
              className={`p-2 rounded-lg transition-colors shadow-sm ${isPanelOpen ? "bg-live-600 text-zinc-950" : "bg-live-500 hover:bg-live-600 text-zinc-950"}`}
              title="Toggle Input Panel"
            >
              <Pencil className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Content Area */}
      <div className="flex-1 relative overflow-hidden bg-zinc-950">
        {/* Live Input Panel */}
        {appMode === "live" && isPanelOpen && (
          <div className="absolute top-2 right-2 bg-zinc-900 border border-zinc-800 p-3 rounded-xl shadow-lg z-30 w-48">
            <div className="flex flex-col gap-3">
              <div className="flex justify-center items-center bg-zinc-950 rounded-lg p-2 border border-zinc-800 h-12 gap-3">
                <span className="text-blue-500 text-2xl font-bold">{liveScoreInput[0] || "-"}</span>
                <span className="text-zinc-500 text-xl font-bold">:</span>
                <span className="text-red-500 text-2xl font-bold">{liveScoreInput[1] || "-"}</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((d) => (
                  <button
                    key={d}
                    onClick={() => {
                      if ('vibrate' in navigator) navigator.vibrate(50);
                      if (liveScoreInput.length < 2) setLiveScoreInput(prev => prev + d);
                    }}
                    className="aspect-square flex items-center justify-center rounded-lg text-lg font-bold border border-zinc-700 text-zinc-300 hover:bg-zinc-800/50 transition-colors"
                  >
                    {d}
                  </button>
                ))}
                <button
                  onClick={() => {
                    if ('vibrate' in navigator) navigator.vibrate(50);
                    setLiveScoreInput("")
                  }}
                  className="aspect-square flex items-center justify-center rounded-lg text-lg font-bold border border-zinc-700 text-red-400 hover:bg-zinc-800/50 transition-colors"
                >
                  C
                </button>
                <button
                  onClick={() => {
                    if ('vibrate' in navigator) navigator.vibrate(50);
                    if (liveScoreInput.length < 2) setLiveScoreInput(prev => prev + "0");
                  }}
                  className="aspect-square flex items-center justify-center rounded-lg text-lg font-bold border border-zinc-700 text-zinc-300 hover:bg-zinc-800/50 transition-colors"
                >
                  0
                </button>
                <button
                  onClick={() => {
                    if ('vibrate' in navigator) navigator.vibrate(50);
                    setLiveScoreInput(prev => prev.slice(0, -1))
                  }}
                  className="aspect-square flex items-center justify-center rounded-lg text-lg font-bold border border-zinc-700 text-zinc-400 hover:bg-zinc-800/50 transition-colors"
                >
                  ⌫
                </button>
              </div>

              <div className="flex items-center gap-2 mt-1">
                <input
                  type="checkbox"
                  id="autoHide"
                  checked={autoHide}
                  onChange={(e) => setAutoHide(e.target.checked)}
                  className="rounded border-zinc-700 bg-zinc-950 text-live-500 focus:ring-live-500"
                />
                <label
                  htmlFor="autoHide"
                  className="text-[11px] leading-tight text-zinc-400"
                >
                  Auto hide
                </label>
              </div>

              <div className="flex gap-2 mt-2">
                <button
                  onClick={handleLiveConfirm}
                  disabled={liveScoreInput.length !== 2}
                  className="flex-1 py-2 bg-live-500 hover:bg-live-600 disabled:opacity-50 disabled:hover:bg-live-500 text-zinc-950 rounded text-sm font-bold transition-colors"
                >
                  Enter
                </button>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={handleLiveUndo}
                  disabled={liveLogs.length === 0}
                  className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 rounded text-xs font-medium transition-colors"
                >
                  Undo
                </button>
                <button
                  onClick={handleLiveReset}
                  disabled={liveLogs.length === 0}
                  className="flex-1 py-1.5 bg-zinc-800 hover:bg-zinc-700 disabled:opacity-50 text-zinc-100 rounded text-xs font-medium transition-colors"
                >
                  Reset
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Chart Tab */}
        <div
          className={`absolute inset-0 transition-opacity duration-200 flex flex-col ${appMode === "live" || activeTab === "chart" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"}`}
        >
          <div className={`w-full flex-1 relative ${appMode === "live" ? "bg-[#1e212b]" : "bg-zinc-950"}`}>
            {/* Chart Controls Group */}
            <div className="absolute top-3 left-3 flex items-center gap-3 z-20 bg-zinc-900/50 p-1.5 rounded-xl backdrop-blur-sm border border-zinc-800/50">
              <button
                onClick={handleDownloadChart}
                className="p-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg transition-colors shadow-sm"
                title="Download Chart Image"
              >
                <Download className="w-5 h-5" />
              </button>
              
              <div className="h-6 w-[1px] bg-zinc-700 mx-1" />

              <button
                onClick={() => setShowBigRoad(!showBigRoad)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${showBigRoad ? (appMode === "simu" ? "bg-[#0EA5E9] text-zinc-950 shadow-[0_0_10px_rgba(14,165,233,0.3)]" : "bg-live-500 text-zinc-950 shadow-[0_0_10px_rgba(77,204,189,0.3)]") : "bg-zinc-800/80 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700"}`}
              >
                Road
              </button>

              <div className="flex bg-zinc-950 p-0.5 rounded-lg border border-zinc-800">
                <button
                  onClick={() => setMaPeriod(0)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${maPeriod === 0 ? "bg-zinc-700 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  OFF
                </button>
                <button
                  onClick={() => setMaPeriod(6)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${maPeriod === 6 ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  6
                </button>
                <button
                  onClick={() => setMaPeriod(9)}
                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-colors ${maPeriod === 9 ? "bg-blue-600 text-white" : "text-zinc-500 hover:text-zinc-300"}`}
                >
                  9
                </button>
              </div>
            </div>

            <div className="absolute inset-0 pt-16 pb-4 px-4">
              <Line ref={chartRef} data={data} options={options} />
            </div>
          </div>
          
          {/* Big Road Container */}
          {showBigRoad && (
            <div className="h-[20%] min-h-[100px] border-t border-zinc-800">
               <BigRoad logs={currentLogs} />
            </div>
          )}
        </div>

        {/* Log Tab */}
        {appMode !== "live" && (
          <div
            className={`absolute inset-0 overflow-y-auto bg-zinc-950 transition-opacity duration-200 ${activeTab === "log" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"}`}
          >
            <table className="w-full text-sm text-center text-zinc-400">
              <thead className="text-xs text-zinc-400 uppercase bg-zinc-900 sticky top-0 shadow-sm z-20">
                <tr>
                  <th className="px-2 py-3 font-semibold">#</th>
                  <th className="px-2 py-3 font-semibold">Score</th>
                  <th className="px-2 py-3 font-semibold">Win</th>
                  <th className="px-2 py-3 font-semibold">Bet</th>
                  <th className="px-2 py-3 font-semibold">Sum</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/50">
                {[...currentLogs].reverse().map((log, i) => {
                  let winType = "";
                  if (log.winner !== "Tie") {
                    const wScore = log.winner === "Player" ? log.playerValue! : log.bankerValue!;
                    const lScore = log.winner === "Player" ? log.bankerValue! : log.playerValue!;
                    if (wScore >= 8) winType = "(S)";
                    else if (wScore - lScore === 1) winType = "(B)";
                    else if (lScore === 0) winType = "(Z)";
                  }
                  return (
                  <tr key={i} className="hover:bg-zinc-800/30 transition-colors">
                    <td className="px-2 py-3 text-zinc-100">{log.handNumber}</td>
                    <td className="px-2 py-3">
                      {log.playerValue !== undefined
                        ? `${log.playerValue}-${log.bankerValue}`
                        : "-"}
                    </td>
                    <td
                      className={`px-2 py-3 font-medium ${
                        log.winner === "Player"
                          ? "text-blue-400"
                          : log.winner === "Banker"
                            ? "text-red-400"
                            : "text-green-400"
                      }`}
                    >
                      {log.winner.charAt(0)}
                      {winType}
                    </td>
                    <td className="px-2 py-3">
                      <span
                        className={`inline-flex items-center justify-center w-6 h-6 rounded text-xs font-bold ${
                          log.betResult === "Win"
                            ? "bg-green-500/20 text-green-400"
                            : log.betResult === "Loss"
                              ? "bg-red-500/20 text-red-400"
                              : log.betResult === "Push"
                                ? "bg-[#0EA5E9]/20 text-[#0EA5E9]"
                                : "text-blue-200/50"
                        }`}
                      >
                        {log.betPlaced ? log.betPlaced.charAt(0) : "-"}
                      </span>
                    </td>
                    <td
                      className={`px-2 py-3 font-bold ${
                        log.runningSum > 0
                          ? "text-green-400"
                          : log.runningSum < 0
                            ? "text-red-400"
                            : "text-zinc-100"
                      }`}
                    >
                      {log.runningSum > 0 ? "+" : ""}
                      {log.runningSum}
                    </td>
                  </tr>
                )})}
              </tbody>
            </table>
          </div>
        )}

        {/* Strategy Tab */}
        {appMode !== "live" && (
          <div
            className={`absolute inset-0 overflow-y-auto bg-zinc-950 transition-opacity duration-200 p-6 ${activeTab === "strategy" ? "opacity-100 z-10" : "opacity-0 pointer-events-none z-0"}`}
          >
            <h2 className="text-xl font-bold text-zinc-100 mb-4">Betting Strategy</h2>
            <div className="space-y-4 text-zinc-300 text-sm">
              <p>
                The system determines the next bet based on the outcome of the previous hand.
              </p>
              <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
                <h3 className="text-[#0EA5E9] font-bold mb-2">Bet on the Streak (Previous Winner)</h3>
                <p className="mb-2">We bet on the streak if any of the following conditions are met:</p>
                <ul className="list-disc pl-5 space-y-2">
                  <li><strong>Strong Win (S):</strong> The winner scored 8 or 9.</li>
                  <li><strong>Bad Beat (B):</strong> The difference between the winner and loser scores is exactly 1 point (e.g., 9-8, 8-7).</li>
                  <li><strong>Baccarat (Z):</strong> The loser scored 0.</li>
                </ul>
              </div>
              <div className="bg-zinc-900 p-4 rounded-lg border border-zinc-800">
                <h3 className="text-red-400 font-bold mb-2">Bet on the Opposite</h3>
                <p>
                  If none of the above conditions are met, we bet on the opposite of the previous winner.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Calculator (Live Mode Only) */}
      {appMode === "live" && (
        <baccarat-calculator className="z-20 px-4 py-4"></baccarat-calculator>
      )}

      {/* Bottom Navigation */}
      {appMode !== "live" && (
        <div className="flex-none flex bg-zinc-900 border-t border-zinc-800 p-2 gap-2 z-20">
          <button
            onClick={() => setActiveTab("chart")}
            className={`flex-1 py-3 flex items-center justify-center rounded-lg transition-colors ${activeTab === "chart" ? (appMode === "live" ? "text-live-500 bg-live-500/10" : "text-[#0EA5E9] bg-[#0EA5E9]/10 shadow-[inset_0_0_10px_rgba(14,165,233,0.2)]") : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"}`}
          >
            <span className="text-xs font-bold uppercase tracking-wider">
              Chart
            </span>
          </button>
          <button
            onClick={() => setActiveTab("log")}
            className={`flex-1 py-3 flex items-center justify-center rounded-lg transition-colors ${activeTab === "log" ? (appMode === "live" ? "text-live-500 bg-live-500/10" : "text-[#0EA5E9] bg-[#0EA5E9]/10 shadow-[inset_0_0_10px_rgba(14,165,233,0.2)]") : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"}`}
          >
            <span className="text-xs font-bold uppercase tracking-wider">
              Audit Log
            </span>
          </button>
          <button
            onClick={() => setActiveTab("strategy")}
            className={`flex-1 py-3 flex items-center justify-center rounded-lg transition-colors ${activeTab === "strategy" ? (appMode === "live" ? "text-live-500 bg-live-500/10" : "text-[#0EA5E9] bg-[#0EA5E9]/10 shadow-[inset_0_0_10px_rgba(14,165,233,0.2)]") : "text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50"}`}
          >
            <span className="text-xs font-bold uppercase tracking-wider">
              Strategy
            </span>
          </button>
        </div>
      )}

      {/* Reset Confirmation Modal */}
      {isResetConfirmOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 p-6 rounded-xl shadow-2xl max-w-xs w-full mx-4">
            <h3 className="text-lg font-bold text-zinc-100 mb-2">
              Reset Data?
            </h3>
            <p className="text-sm text-zinc-400 mb-6">
              This will clear all live tracking data. This action cannot be
              undone.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setIsResetConfirmOpen(false)}
                className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 rounded-lg text-sm font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={confirmReset}
                className="flex-1 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors"
              >
                Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
