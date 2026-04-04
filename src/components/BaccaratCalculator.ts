class BaccaratCalculator extends HTMLElement {
    netUnits: number;
    steps: number;
    unitHistory: number[];
    sessionStartTime: number | null;
    sessions: any[];
    isLogOpen: boolean;
    storageKey: string;
    currentPeak: number;
    maxDrawdown: number;

    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        
        // State
        this.netUnits = 0;
        this.steps = 0;
        this.unitHistory = [];
        this.sessionStartTime = null;
        this.sessions = [];
        this.isLogOpen = false;
        this.storageKey = 'baccarat_sessions_react';
        this.currentPeak = 0;
        this.maxDrawdown = 0;
    }

    connectedCallback() {
        this.storageKey = this.getAttribute('storage-key') || 'baccarat_sessions_react';
        try {
            const saved = localStorage.getItem(this.storageKey);
            if (saved) {
                this.sessions = JSON.parse(saved);
            }
        } catch (e) {
            this.sessions = [];
        }

        this.render();
        this.setupEventListeners();
        this.updateUI();
    }

    recalculateStats() {
        let currentNet = 0;
        let peak = 0;
        let maxDD = 0;
        for (const delta of this.unitHistory) {
            currentNet += delta;
            if (currentNet > peak) {
                peak = currentNet;
            }
            const dd = peak - currentNet;
            if (dd > maxDD) {
                maxDD = dd;
            }
        }
        this.currentPeak = peak;
        this.maxDrawdown = maxDD;
    }

    handleUnitChange(delta: number) {
        if (this.sessionStartTime === null) {
            this.sessionStartTime = Date.now();
        }
        this.netUnits += delta;
        this.steps += 1;
        this.unitHistory.push(delta);
        this.recalculateStats();
        this.updateUI();
    }

    handleUndoUnitChange() {
        if (this.unitHistory.length > 0) {
            const lastDelta = this.unitHistory.pop()!;
            this.netUnits -= lastDelta;
            this.steps -= 1;
            if (this.unitHistory.length === 0) {
                this.sessionStartTime = null;
            }
            this.recalculateStats();
            this.updateUI();
        }
    }

    handleRefreshCalculator() {
        if (this.sessionStartTime !== null && this.steps > 0) {
            const endTime = Date.now();
            const durationMs = endTime - this.sessionStartTime;
            const minutes = Math.floor(durationMs / 60000);
            const seconds = Math.floor((durationMs % 60000) / 1000);
            const durationStr = `${minutes}m ${seconds}s`;
            
            const newSession = {
                id: Math.random().toString(36).substring(2, 9),
                date: new Date().toLocaleString(),
                duration: durationStr,
                net: this.netUnits,
                steps: this.steps,
                maxDrawdown: this.maxDrawdown,
                model: 'sw'
            };
            
            this.sessions.unshift(newSession);
            localStorage.setItem(this.storageKey, JSON.stringify(this.sessions));
        }
        
        this.netUnits = 0;
        this.steps = 0;
        this.unitHistory = [];
        this.sessionStartTime = null;
        this.currentPeak = 0;
        this.maxDrawdown = 0;
        this.updateUI();
    }

    async handlePostData() {
        if (this.sessions.length === 0) return;

        const modal = this.shadowRoot!.getElementById('post-modal-overlay')!;
        const title = this.shadowRoot!.getElementById('post-modal-title')!;
        const message = this.shadowRoot!.getElementById('post-modal-message')!;
        const closeBtn = this.shadowRoot!.getElementById('btn-post-modal-close')!;

        modal.classList.remove('hidden');
        title.textContent = 'Posting Data...';
        message.textContent = 'Please wait while your session history is being saved.';
        closeBtn.classList.add('hidden');

        const rows = this.sessions.map(session => {
            const datePart = session.date.includes(',') ? session.date.split(',')[0].trim() : session.date;
            const timePart = session.date.includes(',') ? session.date.split(',')[1]?.trim() : '';
            return [
                datePart,
                timePart,
                session.duration,
                session.steps || 0,
                session.net,
                -(session.maxDrawdown || 0),
                session.model || 'sw'
            ];
        });

        try {
            const response = await fetch('https://script.google.com/macros/s/AKfycbwo4niqEJg4EoXTGf0ik0b0H5IGou16IYmdHGWFeP_5lp2zFqxrCAOETnjP8_IN2BPL/exec', {
                method: 'POST',
                body: JSON.stringify(rows),
            });

            const resultText = await response.text();
            let result;
            try {
                result = JSON.parse(resultText);
            } catch (e) {
                result = { status: resultText.toLowerCase().includes('success') ? 'success' : 'error', message: resultText };
            }
            
            if (result.status === 'success' || result.result === 'success') {
                title.textContent = 'Success';
                message.textContent = `Session history successfully posted to Google Sheets. (${result.rows || rows.length} rows)`;
            } else {
                throw new Error(result.message || 'Unknown error from server');
            }
        } catch (error: any) {
            title.textContent = 'Error';
            const errMsg = error.message || String(error);
            if (errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
                message.textContent = "Network error (CORS). This usually means your Google Apps Script threw an internal error (like getActiveSpreadsheet returning null) or needs to be redeployed as a New Version.";
            } else {
                message.textContent = 'Failed to post data: ' + errMsg;
            }
        } finally {
            closeBtn.classList.remove('hidden');
        }
    }

    handleExportCSV() {
        const headers = ['Date', 'Time', 'Duration', 'Steps', 'Net', 'Max DD', 'Model'];
        const rows = this.sessions.map(session => {
            const datePart = session.date.includes(',') ? session.date.split(',')[0].trim() : session.date;
            const timePart = session.date.includes(',') ? session.date.split(',')[1]?.trim() : '';
            return [
                datePart,
                timePart,
                session.duration,
                session.steps || 0,
                session.net,
                session.maxDrawdown || 0,
                session.model || 'sw'
            ].join(',');
        });
        
        const csvContent = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.setAttribute('href', url);
        link.setAttribute('download', 'baccarat_sessions.csv');
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    }

    toggleCalcLog() {
        this.isLogOpen = !this.isLogOpen;
        this.updateUI();
    }

    clearAllSessions() {
        const modal = this.shadowRoot!.getElementById('calc-modal-overlay')!;
        modal.classList.remove('hidden');
    }

    confirmClearAll() {
        this.sessions = [];
        localStorage.setItem(this.storageKey, JSON.stringify(this.sessions));
        this.updateUI();
        this.closeModal();
    }

    closeModal() {
        const modal = this.shadowRoot!.getElementById('calc-modal-overlay')!;
        modal.classList.add('hidden');
    }

    setupEventListeners() {
        this.shadowRoot!.getElementById('btn-calc-minus')!.addEventListener('click', () => this.handleUnitChange(-1));
        this.shadowRoot!.getElementById('btn-calc-plus')!.addEventListener('click', () => this.handleUnitChange(1));
        this.shadowRoot!.getElementById('btn-calc-undo')!.addEventListener('click', () => this.handleUndoUnitChange());
        this.shadowRoot!.getElementById('btn-calc-refresh')!.addEventListener('click', () => this.handleRefreshCalculator());
        this.shadowRoot!.getElementById('btn-calc-log')!.addEventListener('click', () => this.toggleCalcLog());
        this.shadowRoot!.getElementById('btn-calc-post')!.addEventListener('click', () => this.handlePostData());
        this.shadowRoot!.getElementById('btn-calc-export-csv')!.addEventListener('click', () => this.handleExportCSV());
        this.shadowRoot!.getElementById('btn-calc-clear-all')!.addEventListener('click', () => this.clearAllSessions());
        this.shadowRoot!.getElementById('btn-modal-cancel')!.addEventListener('click', () => this.closeModal());
        this.shadowRoot!.getElementById('btn-modal-confirm')!.addEventListener('click', () => this.confirmClearAll());
        this.shadowRoot!.getElementById('btn-post-modal-close')!.addEventListener('click', () => {
            this.shadowRoot!.getElementById('post-modal-overlay')!.classList.add('hidden');
        });
    }

    updateUI() {
        // Value
        const calcNetValue = this.shadowRoot!.getElementById('calc-net-value')!;
        
        calcNetValue.textContent = (this.netUnits > 0 ? '+' : '') + this.netUnits;
        calcNetValue.className = 'calc-value';
        if (this.netUnits > 0) calcNetValue.classList.add('positive');
        else if (this.netUnits < 0) calcNetValue.classList.add('negative');

        // Buttons
        (this.shadowRoot!.getElementById('btn-calc-undo') as HTMLButtonElement).disabled = this.unitHistory.length === 0;

        // Panel
        const calcLogPanel = this.shadowRoot!.getElementById('calc-log-panel')!;
        const btnCalcLog = this.shadowRoot!.getElementById('btn-calc-log')!;
        if (this.isLogOpen) {
            calcLogPanel.classList.remove('hidden');
            btnCalcLog.classList.add('active');
        } else {
            calcLogPanel.classList.add('hidden');
            btnCalcLog.classList.remove('active');
        }

        // Subtotal
        const subtotal = this.sessions.reduce((sum: any, session: any) => sum + session.net, 0);
        const calcSubtotal = this.shadowRoot!.getElementById('calc-subtotal')!;
        const calcSubtotalValue = this.shadowRoot!.getElementById('calc-subtotal-value')!;
        
        if (this.sessions.length > 0 && this.isLogOpen) {
            calcSubtotal.classList.remove('hidden');
            calcSubtotalValue.textContent = (subtotal > 0 ? '+' : '') + subtotal;
            calcSubtotalValue.className = 'calc-subtotal-value';
            if (subtotal > 0) {
                calcSubtotalValue.classList.add('positive');
                calcSubtotal.style.backgroundColor = 'rgba(6, 78, 59, 0.2)';
            } else if (subtotal < 0) {
                calcSubtotalValue.classList.add('negative');
                calcSubtotal.style.backgroundColor = 'rgba(159, 18, 57, 0.2)';
            } else {
                calcSubtotalValue.classList.add('neutral');
                calcSubtotal.style.backgroundColor = 'rgba(39, 39, 42, 0.5)';
            }
        } else {
            calcSubtotal.classList.add('hidden');
        }

        // List
        const calcLogEmpty = this.shadowRoot!.getElementById('calc-log-empty')!;
        const calcLogList = this.shadowRoot!.getElementById('calc-log-list')!;
        const btnCalcClearAll = this.shadowRoot!.getElementById('btn-calc-clear-all')!;
        const btnCalcExportCsv = this.shadowRoot!.getElementById('btn-calc-export-csv')!;
        const btnCalcPost = this.shadowRoot!.getElementById('btn-calc-post')!;

        if (this.sessions.length === 0) {
            calcLogEmpty.style.display = 'block';
            calcLogList.style.display = 'none';
            btnCalcClearAll.classList.add('hidden');
            btnCalcExportCsv.classList.add('hidden');
            btnCalcPost.classList.add('hidden');
        } else {
            calcLogEmpty.style.display = 'none';
            calcLogList.style.display = 'block';
            btnCalcClearAll.classList.remove('hidden');
            btnCalcExportCsv.classList.remove('hidden');
            btnCalcPost.classList.remove('hidden');
            
            calcLogList.innerHTML = '';
            
            // Group by date
            const groupedSessions = this.sessions.reduce((acc: any, session: any) => {
                const datePart = session.date.split(',')[0];
                if (!acc[datePart]) acc[datePart] = [];
                acc[datePart].push(session);
                return acc;
            }, {});

            Object.entries(groupedSessions).forEach(([date, dateSessions]: [string, any]) => {
                const groupDiv = document.createElement('div');
                groupDiv.className = 'calc-log-group';
                
                const header = document.createElement('h4');
                header.className = 'calc-log-group-header';
                header.textContent = date;
                groupDiv.appendChild(header);
                
                const tableContainer = document.createElement('div');
                tableContainer.className = 'calc-log-table-container';
                
                const table = document.createElement('table');
                table.className = 'calc-log-table';
                
                const thead = document.createElement('thead');
                thead.innerHTML = `
                    <tr>
                        <th>Time</th>
                        <th>Duration</th>
                        <th class="text-center">Steps</th>
                        <th class="text-center">Max<br>DD</th>
                        <th class="text-right">Net</th>
                        <th class="hidden">Model</th>
                    </tr>
                `;
                table.appendChild(thead);
                
                const tbody = document.createElement('tbody');
                dateSessions.forEach((session: any) => {
                    const tr = document.createElement('tr');
                    let timePart = session.date.split(',')[1] ? session.date.split(',')[1].trim() : session.date;
                    timePart = timePart.replace(' AM', '<br>AM').replace(' PM', '<br>PM');
                    const netClass = session.net > 0 ? 'text-emerald' : session.net < 0 ? 'text-rose' : 'text-zinc';
                    const netText = (session.net > 0 ? '+' : '') + session.net;
                    const stepsText = session.steps || 0;
                    const maxDDClass = session.maxDrawdown > 0 ? 'text-rose' : 'text-zinc';
                    const maxDDText = session.maxDrawdown > 0 ? `-${session.maxDrawdown}` : '0';
                    const modelText = session.model || 'sw';
                    
                    tr.innerHTML = `
                        <td class="text-zinc-400" style="max-width: 80px; word-wrap: break-word;">${timePart}</td>
                        <td class="text-zinc-300">${session.duration}</td>
                        <td class="text-zinc-300 text-center">${stepsText}</td>
                        <td class="${maxDDClass} text-center">${maxDDText}</td>
                        <td class="font-bold text-right ${netClass}">${netText}</td>
                        <td class="hidden">${modelText}</td>
                    `;
                    tbody.appendChild(tr);
                });
                
                table.appendChild(tbody);
                tableContainer.appendChild(table);
                groupDiv.appendChild(tableContainer);
                calcLogList.appendChild(groupDiv);
            });
        }
    }

    render() {
        this.shadowRoot!.innerHTML = `
            <style>
                :host {
                    --zinc-900: #18181b;
                    --zinc-800: #27272a;
                    --zinc-500: #71717a;
                    --zinc-400: #a1a1aa;
                    --zinc-300: #d4d4d8;
                    --zinc-100: #f4f4f5;
                    --emerald-400: #34d399;
                    --rose-400: #fb7185;
                    --rose-300: #fda4af;
                    --cyan-400: #22d3ee;
                    --cyan-300: #67e8f9;

                    display: block;
                    box-sizing: border-box;
                    width: 100%;
                    background-color: var(--zinc-900);
                    border-top: 1px solid rgba(39, 39, 42, 0.8);
                    flex-shrink: 0;
                    font-family: 'Inter', sans-serif;
                    color: var(--zinc-100);
                }
                
                * {
                    box-sizing: border-box;
                    margin: 0;
                    padding: 0;
                }

                .calc-container {
                    padding: 16px;
                    width: 100%;
                }

                .calc-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                }

                .calc-net {
                    display: flex;
                    align-items: center;
                    flex-shrink: 0;
                    margin-right: auto;
                }

                .calc-value {
                    font-size: 28px;
                    font-weight: 700;
                    color: var(--zinc-100);
                }

                .calc-value.positive { color: var(--emerald-400); }
                .calc-value.negative { color: var(--rose-400); }

                .calc-actions {
                    display: flex;
                    align-items: center;
                    gap: 6px;
                    flex-wrap: nowrap;
                    justify-content: flex-end;
                }

                .btn-calc {
                    width: 40px;
                    height: 40px;
                    border-radius: 8px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-weight: 700;
                    font-size: 16px;
                    cursor: pointer;
                    transition: all 0.2s;
                    border: 1px solid transparent;
                    flex-shrink: 0;
                }

                .btn-calc-minus {
                    background-color: rgba(159, 18, 57, 0.3);
                    color: var(--rose-400);
                    border-color: rgba(159, 18, 57, 0.4);
                }

                .btn-calc-minus:hover {
                    background-color: rgba(159, 18, 57, 0.4);
                }

                .btn-calc-plus {
                    background-color: rgba(6, 78, 59, 0.3);
                    color: var(--emerald-400);
                    border-color: rgba(6, 78, 59, 0.4);
                }

                .btn-calc-plus:hover {
                    background-color: rgba(6, 78, 59, 0.4);
                }

                .btn-calc-undo {
                    background-color: rgba(39, 39, 42, 0.8);
                    color: var(--zinc-300);
                    border-color: rgba(63, 63, 70, 0.5);
                }

                .btn-calc-undo:not(:disabled):hover {
                    background-color: rgba(63, 63, 70, 0.8);
                }

                .btn-calc-undo:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .calc-divider {
                    width: 1px;
                    height: 32px;
                    background-color: var(--zinc-800);
                    margin: 0 8px;
                }

                .btn-calc-icon {
                    padding: 8px;
                    border-radius: 8px;
                    background-color: rgba(39, 39, 42, 0.8);
                    color: var(--zinc-300);
                    border: none;
                    cursor: pointer;
                    transition: all 0.2s;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    flex-shrink: 0;
                }

                .btn-calc-icon:hover {
                    background-color: rgba(63, 63, 70, 0.8);
                }

                .btn-calc-icon.active {
                    background-color: rgba(6, 182, 212, 0.2);
                    color: var(--cyan-400);
                }

                .calc-subtotal {
                    margin-top: 24px;
                    padding: 16px;
                    background-color: rgba(6, 78, 59, 0.2);
                    border-radius: 8px;
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    font-size: 14px;
                    color: var(--zinc-300);
                }
                .calc-subtotal.hidden {
                    display: none;
                }
                .calc-subtotal-value {
                    font-size: 16px;
                    font-weight: 700;
                }
                .calc-subtotal-value.positive { color: var(--emerald-400); }
                .calc-subtotal-value.negative { color: var(--rose-400); }
                .calc-subtotal-value.neutral { color: var(--zinc-100); }

                .calc-log-panel {
                    margin-top: 24px;
                    padding-top: 0;
                }

                .calc-log-panel.hidden {
                    display: none;
                }

                .calc-log-header {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    margin-bottom: 16px;
                    flex-wrap: wrap;
                    gap: 12px;
                }

                .calc-log-header h3 {
                    font-size: 16px;
                    font-weight: 700;
                    color: var(--zinc-100);
                }

                .calc-log-header-actions {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                }

                .btn-calc-export-csv, .btn-calc-post {
                    background: none;
                    border: none;
                    color: var(--cyan-400);
                    font-size: 13px;
                    font-weight: 500;
                    padding: 0;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-calc-export-csv:hover, .btn-calc-post:hover {
                    color: var(--cyan-300);
                }

                .btn-calc-export-csv.hidden, .btn-calc-post.hidden {
                    display: none;
                }

                .btn-calc-clear-all {
                    background: none;
                    border: none;
                    color: var(--rose-400);
                    font-size: 13px;
                    font-weight: 500;
                    padding: 0;
                    cursor: pointer;
                    transition: all 0.2s;
                }

                .btn-calc-clear-all:hover {
                    color: var(--rose-300);
                }

                .btn-calc-clear-all.hidden {
                    display: none;
                }

                .calc-log-empty {
                    font-size: 14px;
                    color: var(--zinc-500);
                    font-style: italic;
                }

                .calc-log-list {
                    display: flex;
                    flex-direction: column;
                    gap: 24px;
                    max-height: 240px;
                    overflow-y: auto;
                    padding-right: 8px;
                }

                .calc-log-group {
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .calc-log-group-header {
                    font-size: 13px;
                    font-weight: 600;
                    color: var(--zinc-500);
                    position: sticky;
                    top: 0;
                    background-color: var(--zinc-900);
                    padding: 8px 0;
                    z-index: 1;
                    margin-bottom: 4px;
                }

                .calc-log-table-container {
                    background-color: transparent;
                    border-radius: 8px;
                    overflow: hidden;
                }

                .calc-log-table {
                    width: 100%;
                    border-collapse: collapse;
                    font-size: 13px;
                    text-align: left;
                }

                .calc-log-table th {
                    font-size: 11px;
                    color: var(--zinc-400);
                    background-color: transparent;
                    border-bottom: 1px solid rgba(39, 39, 42, 0.8);
                    padding: 12px 4px;
                    font-weight: 500;
                }

                .calc-log-table td {
                    padding: 12px 4px;
                    border-bottom: 1px solid rgba(39, 39, 42, 0.3);
                    font-variant-numeric: tabular-nums;
                    background-color: transparent;
                }

                .calc-log-table tr:last-child td {
                    border-bottom: none;
                }

                .calc-log-table tr:hover td {
                    background-color: rgba(39, 39, 42, 0.3);
                }

                .text-right { text-align: right; }
                .text-center { text-align: center; }
                .text-zinc-400 { color: var(--zinc-400); }
                .text-zinc-300 { color: var(--zinc-300); }
                .text-emerald { color: var(--emerald-400); }
                .text-rose { color: var(--rose-400); }
                .text-zinc { color: var(--zinc-400); }
                .font-bold { font-weight: 700; }
                .hidden { display: none !important; }

                .calc-modal-overlay {
                    position: fixed;
                    inset: 0;
                    background-color: rgba(0, 0, 0, 0.8);
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    z-index: 9999;
                    backdrop-filter: blur(4px);
                }

                .calc-modal {
                    background-color: var(--zinc-900);
                    border: 1px solid rgba(39, 39, 42, 0.8);
                    padding: 24px;
                    border-radius: 12px;
                    max-width: 320px;
                    width: 100%;
                    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.5), 0 10px 10px -5px rgba(0, 0, 0, 0.3);
                }

                .calc-modal h3 {
                    font-size: 18px;
                    font-weight: 600;
                    margin-bottom: 8px;
                    color: var(--zinc-100);
                }

                .calc-modal p {
                    font-size: 14px;
                    color: var(--zinc-400);
                    margin-bottom: 24px;
                    line-height: 1.5;
                }

                .calc-modal-actions {
                    display: flex;
                    justify-content: flex-end;
                    gap: 12px;
                }

                .btn-modal-cancel {
                    background: none;
                    border: none;
                    color: var(--zinc-300);
                    padding: 8px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 14px;
                    transition: background-color 0.2s;
                }

                .btn-modal-cancel:hover {
                    background-color: var(--zinc-800);
                }

                .btn-modal-confirm {
                    background-color: rgba(244, 63, 94, 0.1);
                    border: 1px solid rgba(244, 63, 94, 0.2);
                    color: var(--rose-400);
                    padding: 8px 16px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: 500;
                    font-size: 14px;
                    transition: background-color 0.2s;
                }

                .btn-modal-confirm:hover {
                    background-color: rgba(244, 63, 94, 0.2);
                }
            </style>
            
            <div class="calc-container">
                <div class="calc-header">
                    <div class="calc-net">
                        <span id="calc-net-value" class="calc-value">0</span>
                    </div>
                    <div class="calc-actions">
                        <button id="btn-calc-minus" class="btn-calc btn-calc-minus">-1</button>
                        <button id="btn-calc-plus" class="btn-calc btn-calc-plus">+1</button>
                        <button id="btn-calc-undo" class="btn-calc btn-calc-undo" disabled>C</button>
                        <div class="calc-divider"></div>
                        <button id="btn-calc-refresh" class="btn-calc-icon" title="Refresh Session">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
                        </button>
                        <button id="btn-calc-log" class="btn-calc-icon" title="Session Log">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                        </button>
                    </div>
                </div>
                
                <div id="calc-subtotal" class="calc-subtotal hidden">
                    <span>Subtotal</span>
                    <span id="calc-subtotal-value" class="calc-subtotal-value">+0</span>
                </div>

                <div id="calc-log-panel" class="calc-log-panel hidden">
                    <div class="calc-log-header">
                        <h3>Session History</h3>
                        <div class="calc-log-header-actions">
                            <button id="btn-calc-post" class="btn-calc-post hidden">Post</button>
                            <button id="btn-calc-export-csv" class="btn-calc-export-csv hidden">Export CSV</button>
                            <button id="btn-calc-clear-all" class="btn-calc-clear-all hidden">Clear All</button>
                        </div>
                    </div>
                    <div id="calc-log-empty" class="calc-log-empty">No sessions recorded yet.</div>
                    <div id="calc-log-list" class="calc-log-list"></div>
                </div>
            </div>

            <div id="calc-modal-overlay" class="calc-modal-overlay hidden">
                <div class="calc-modal">
                    <h3>Clear Session History?</h3>
                    <p>This will permanently delete all recorded sessions. This action cannot be undone.</p>
                    <div class="calc-modal-actions">
                        <button id="btn-modal-cancel" class="btn-modal-cancel">Cancel</button>
                        <button id="btn-modal-confirm" class="btn-modal-confirm">Clear All</button>
                    </div>
                </div>
            </div>

            <div id="post-modal-overlay" class="calc-modal-overlay hidden">
                <div class="calc-modal">
                    <h3 id="post-modal-title">Posting Data...</h3>
                    <p id="post-modal-message">Please wait while your session history is being saved.</p>
                    <div class="calc-modal-actions">
                        <button id="btn-post-modal-close" class="btn-modal-cancel hidden">Close</button>
                    </div>
                </div>
            </div>
        `;
    }
}

customElements.define('baccarat-calculator', BaccaratCalculator);
