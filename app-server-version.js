/**
 * Child Life Calendar - Server Version
 * Works with local HTTP server for reliable video playback
 */

'use strict';

const VIDEO_SERVER_URL = 'http://localhost:8080';

// Single source of truth for the week. Index in this array == day offset from
// the (Monday) week start, so DAYS[0]=Monday ... DAYS[6]=Sunday.
// Each day owns three consecutive event indices: Morning, Afternoon, Evening.
const DAYS = [
    { name: 'Monday',    key: 'mon', indices: [0, 1, 2] },
    { name: 'Tuesday',   key: 'tue', indices: [3, 4, 5] },
    { name: 'Wednesday', key: 'wed', indices: [6, 7, 8] },
    { name: 'Thursday',  key: 'thu', indices: [9, 10, 11] },
    { name: 'Friday',    key: 'fri', indices: [12, 13, 14] },
    { name: 'Saturday',  key: 'sat', indices: [15, 16, 17] },
    { name: 'Sunday',    key: 'sun', indices: [18, 19, 20] }
];
const DAY_KEYS = DAYS.map(d => d.key);
const WEEKDAY_KEYS = ['mon', 'tue', 'wed', 'thu', 'fri'];
const TIMES = ['morning', 'afternoon', 'evening'];
const TIMES_CAP = ['Morning', 'Afternoon', 'Evening'];

const TIME_OPTIONS = {
    morning: ['09:00', '09:30', '10:00', '10:30', '11:00', '11:30'],
    afternoon: ['12:00', '12:30', '13:00', '13:30', '14:00', '14:30', '15:00', '15:30'],
    evening: ['16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30']
};

const MONTH_NAMES = ["January", "February", "March", "April", "May", "June",
                     "July", "August", "September", "October", "November", "December"];

const DEFAULT_ROTATION_SECONDS = 15;
const MIN_ROTATION_SECONDS = 3;
const MAX_ROTATION_SECONDS = 600;
const SCHEMA_VERSION = 2;

class ChildLifeCalendar {
    constructor() {
        // Core data
        this.events = new Array(21).fill("No Event");
        this.videoSchedule = {};
        this.availableVideos = [];
        this.currentMonth = 4;
        this.qrCodeVisible = false;
        this.selectedWeekStart = this.getMondayOfCurrentWeek();
        this.rotationSeconds = DEFAULT_ROTATION_SECONDS;

        // UI state
        this.currentView = 'display';
        this.currentTab = 'events';

        // Video playback
        this.scheduledVideoTimer = null;
        this.isVideoPlaying = false;
        this.videoCounters = {};

        // Display rotation
        this.rotationTimer = null;
        this.rotationIndex = 0;
        // The order screens cycle through: each day on its own, then the full
        // Mon-Fri grid, then a Saturday + Sunday weekend screen.
        this.rotationSequence = [
            ...DAYS.map(d => ({ type: 'day', day: d.key })),
            { type: 'weekgrid' },
            { type: 'weekend' }
        ];

        this.init();
    }

    init() {
        console.log('🎯 Child Life Calendar initializing (Server Version)...');

        try {
            this.setupEventListeners();
            this.initializeVideoCounters();
            this.loadFromStorage();
            this.applyMonthTheme(this.currentMonth);
            this.updateWeekDisplay();
            this.checkServerAndLoadVideos();
            this.startVideoScheduleChecker();
            this.startRotation();

            setTimeout(() => this.requestFullscreen(), 1000);

            console.log('✅ Initialization complete');
        } catch (error) {
            console.error('❌ Error during initialization:', error);
        }
    }

    getMondayOfCurrentWeek() {
        const today = new Date();
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        return new Date(today.setDate(diff));
    }

    initializeVideoCounters() {
        DAY_KEYS.forEach(day => {
            TIMES.forEach(time => {
                const key = `${day}-${time}`;
                if (!(key in this.videoCounters)) {
                    this.videoCounters[key] = 0;
                }
                if (!this.videoSchedule[key]) {
                    this.videoSchedule[key] = [];
                }
            });
        });
    }

    async checkServerAndLoadVideos() {
        console.log('🔍 Checking video server...');
        const displayEl = document.getElementById('folderDisplay');

        try {
            const response = await fetch(`${VIDEO_SERVER_URL}/videos/`);

            if (!response.ok) {
                throw new Error('Server not responding');
            }

            const html = await response.text();

            // Parse video files from the server's HTML response
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const videoLinks = doc.querySelectorAll('a[href*=".mp4"], a[href*=".avi"], a[href*=".mov"], a[href*=".wmv"], a[href*=".webm"], a[href*=".mkv"], a[href*=".m4v"]');

            this.availableVideos = Array.from(videoLinks).map(link => {
                const href = link.getAttribute('href');
                // Extract just the filename from /videos/filename.mp4
                return href.split('/').pop();
            });

            console.log(`✅ Found ${this.availableVideos.length} videos on server`);
            console.log('📹 Videos:', this.availableVideos);

            if (displayEl) {
                displayEl.textContent = `✓ Server connected (${this.availableVideos.length} videos available)`;
                displayEl.style.color = '#27ae60';
            }

            this.populateVideoDropdowns();

        } catch (error) {
            console.error('❌ Video server not accessible:', error);

            if (displayEl) {
                displayEl.textContent = '❌ Video server not running! Start video-server.ps1';
                displayEl.style.color = '#e74c3c';
            }

            this.availableVideos = [];
        }
    }

    populateVideoDropdowns() {
        DAY_KEYS.forEach(day => {
            TIMES.forEach(time => {
                const key = `${day}-${time}`;
                const container = document.querySelector(`[data-slot="${key}"]`);

                if (container) {
                    const existingEntries = container.querySelectorAll('.video-entry');

                    existingEntries.forEach(entry => {
                        const videoSelect = entry.querySelector('.video-select');
                        if (videoSelect) {
                            // Clear and repopulate
                            while (videoSelect.children.length > 1) {
                                videoSelect.removeChild(videoSelect.lastChild);
                            }

                            this.availableVideos.forEach(filename => {
                                const option = document.createElement('option');
                                option.value = filename;
                                option.textContent = filename;
                                videoSelect.appendChild(option);
                            });
                        }
                    });
                }
            });
        });

        console.log('✅ Video dropdowns populated');
    }

    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') this.toggleView();
        });

        // Tab switching
        document.getElementById('eventsTab')?.addEventListener('click', () => this.switchTab('events'));
        document.getElementById('videosTab')?.addEventListener('click', () => this.switchTab('videos'));

        // Control buttons
        document.getElementById('saveBtn')?.addEventListener('click', () => this.saveEvents());
        document.getElementById('saveVideosBtn')?.addEventListener('click', () => this.saveVideoSchedule());
        document.getElementById('resetBtn')?.addEventListener('click', () => this.resetEvents());
        document.getElementById('loadBtn')?.addEventListener('click', () => this.loadFromStorage());
        document.getElementById('displayBtn')?.addEventListener('click', () => this.switchToDisplay());
        document.getElementById('toggleQR')?.addEventListener('click', () => this.toggleQRCode());
        document.getElementById('refreshVideosBtn')?.addEventListener('click', () => this.checkServerAndLoadVideos());

        // Video player controls
        document.getElementById('stopVideoBtn')?.addEventListener('click', () => this.stopVideo());
        document.getElementById('skipVideoBtn')?.addEventListener('click', () => this.stopVideo());
        document.getElementById('mainVideo')?.addEventListener('ended', () => this.stopVideo());

        // Month and week selectors
        document.getElementById('monthSelect')?.addEventListener('change', (e) => {
            this.currentMonth = parseInt(e.target.value);
            this.applyMonthTheme(this.currentMonth);
        });

        document.getElementById('weekPicker')?.addEventListener('change', (e) => {
            if (e.target.value) {
                this.selectedWeekStart = new Date(e.target.value + 'T00:00:00');
                this.updateWeekDisplay();
                this.renderCurrentScreen();
            }
        });

        // Rotation timing
        document.getElementById('rotationSeconds')?.addEventListener('change', (e) => {
            this.setRotationSeconds(e.target.value);
        });

        // Hamburger menu (holds the Save/Load/Reset/Display controls)
        this.setupMenu();

        // Generate editor fields
        this.generateEditorFields();
        this.generateVideoScheduleGrid();
    }

    setupMenu() {
        const menuToggle = document.getElementById('menuToggle');
        const menuPanel = document.getElementById('menuPanel');
        if (!menuToggle || !menuPanel) return;

        const closeMenu = () => {
            menuPanel.classList.remove('open');
            menuToggle.setAttribute('aria-expanded', 'false');
        };

        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = menuPanel.classList.toggle('open');
            menuToggle.setAttribute('aria-expanded', isOpen ? 'true' : 'false');
        });

        // Close after picking an action inside the menu.
        menuPanel.addEventListener('click', () => closeMenu());

        // Close when clicking anywhere outside the menu.
        document.addEventListener('click', (e) => {
            if (menuPanel.classList.contains('open') &&
                !menuPanel.contains(e.target) && e.target !== menuToggle) {
                closeMenu();
            }
        });
    }

    generateEditorFields() {
        const editorBody = document.getElementById('eventsEditorTab');
        if (!editorBody) return;

        DAYS.forEach(day => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'editor-day';
            dayDiv.innerHTML = `
                <h3>${day.name}</h3>
                <div class="date-display" id="editor-date-${day.key}"></div>
            `;

            TIMES_CAP.forEach((time, i) => {
                const eventIndex = day.indices[i];
                const slotDiv = document.createElement('div');
                slotDiv.className = 'editor-slot';
                slotDiv.innerHTML = `
                    <label>${time}</label>
                    <div class="formatting-toolbar">
                        <button onclick="document.execCommand('bold', false, '');" title="Bold">B</button>
                        <button onclick="document.execCommand('italic', false, '');" title="Italic">I</button>
                        <button onclick="document.execCommand('underline', false, '');" title="Underline">U</button>
                    </div>
                    <textarea id="input-${eventIndex}" placeholder="${time} Event"></textarea>
                `;
                dayDiv.appendChild(slotDiv);

                // Add event listener
                const textarea = slotDiv.querySelector('textarea');
                textarea.addEventListener('input', (e) => {
                    this.events[eventIndex] = e.target.value || "No Event";
                });
            });

            editorBody.appendChild(dayDiv);
        });
    }

    generateVideoScheduleGrid() {
        const videoGrid = document.getElementById('videoGrid');
        if (!videoGrid) return;

        DAYS.forEach(day => {
            const dayDiv = document.createElement('div');
            dayDiv.className = 'video-day';
            dayDiv.innerHTML = `
                <h3>${day.name}</h3>
                <div class="date-display" id="video-date-${day.key}"></div>
            `;

            TIMES.forEach(time => {
                const slotKey = `${day.key}-${time}`;
                const slotDiv = document.createElement('div');
                slotDiv.className = 'video-slot';
                slotDiv.setAttribute('data-slot', slotKey);
                slotDiv.innerHTML = `
                    <label>${time.charAt(0).toUpperCase() + time.slice(1)}</label>
                    <div class="video-entries"></div>
                    <button class="add-video-btn" data-day="${day.key}" data-time="${time}">+ Add Video</button>
                `;

                // Add initial video entry
                this.addVideoEntry(slotDiv.querySelector('.video-entries'), day.key, time, TIME_OPTIONS[time]);

                // Add button event
                slotDiv.querySelector('.add-video-btn').addEventListener('click', (e) => {
                    const entriesContainer = e.target.previousElementSibling;
                    this.addVideoEntry(entriesContainer, day.key, time, TIME_OPTIONS[time]);
                    this.videoCounters[slotKey]++;

                    if (this.videoCounters[slotKey] >= 5) {
                        e.target.disabled = true;
                        e.target.textContent = 'Max 5 videos';
                    }
                });

                dayDiv.appendChild(slotDiv);
            });

            videoGrid.appendChild(dayDiv);
        });
    }

    addVideoEntry(container, day, time, timeOptions) {
        const entryDiv = document.createElement('div');
        entryDiv.className = 'video-entry';

        const slotKey = `${day}-${time}`;
        const index = this.videoCounters[slotKey] || 0;
        this.videoCounters[slotKey] = index + 1;

        const timeSelect = document.createElement('select');
        timeSelect.className = 'time-select';
        timeSelect.innerHTML = '<option value="">Time</option>';
        timeOptions.forEach(t => {
            timeSelect.innerHTML += `<option value="${t}">${t}</option>`;
        });

        const videoSelect = document.createElement('select');
        videoSelect.className = 'video-select';
        videoSelect.innerHTML = '<option value="">Select Video</option>';

        this.availableVideos.forEach(filename => {
            videoSelect.innerHTML += `<option value="${filename}">${filename}</option>`;
        });

        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-video';
        removeBtn.textContent = '×';
        removeBtn.addEventListener('click', () => {
            entryDiv.remove();
            this.videoCounters[slotKey]--;
            this.updateVideoSchedule();

            const addBtn = container.parentElement.querySelector('.add-video-btn');
            if (addBtn.disabled) {
                addBtn.disabled = false;
                addBtn.textContent = '+ Add Video';
            }
        });

        entryDiv.appendChild(timeSelect);
        entryDiv.appendChild(videoSelect);
        entryDiv.appendChild(removeBtn);
        container.appendChild(entryDiv);

        timeSelect.addEventListener('change', () => this.updateVideoSchedule());
        videoSelect.addEventListener('change', () => this.updateVideoSchedule());
    }

    updateVideoSchedule() {
        DAY_KEYS.forEach(day => {
            TIMES.forEach(time => {
                const key = `${day}-${time}`;
                const container = document.querySelector(`[data-slot="${key}"]`);

                if (container) {
                    const entries = container.querySelectorAll('.video-entry');
                    this.videoSchedule[key] = [];

                    entries.forEach(entry => {
                        const timeSelect = entry.querySelector('.time-select');
                        const videoSelect = entry.querySelector('.video-select');

                        if (timeSelect.value && videoSelect.value) {
                            this.videoSchedule[key].push({
                                time: timeSelect.value,
                                video: videoSelect.value
                            });
                        }
                    });
                }
            });
        });
    }

    startVideoScheduleChecker() {
        console.log('⏰ Starting video schedule checker...');

        this.scheduledVideoTimer = setInterval(() => {
            if (!this.isVideoPlaying && this.currentView === 'display') {
                this.checkForScheduledVideo();
            }
        }, 30000);

        setTimeout(() => {
            if (!this.isVideoPlaying && this.currentView === 'display') {
                this.checkForScheduledVideo();
            }
        }, 2000);
    }

    checkForScheduledVideo() {
        const now = new Date();
        const currentDay = this.getCurrentDayKey(now);
        const currentTime = this.getCurrentTimeSlot(now);
        const currentTimeString = this.formatTime(now);

        if (!currentDay || !currentTime) return;

        const scheduleKey = `${currentDay}-${currentTime}`;
        const scheduledItems = this.videoSchedule[scheduleKey];

        if (scheduledItems && scheduledItems.length > 0) {
            scheduledItems.forEach(item => {
                if (this.isTimeMatch(currentTimeString, item.time)) {
                    console.log(`✅ Time match! Playing: ${item.video}`);
                    this.playScheduledVideo(item.video);
                }
            });
        }
    }

    getCurrentDayKey(date) {
        const dayMap = { 0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat' };
        return dayMap[date.getDay()] || null;
    }

    getCurrentTimeSlot(date) {
        const hour = date.getHours();
        if (hour >= 9 && hour < 12) return 'morning';
        if (hour >= 12 && hour < 16) return 'afternoon';
        if (hour >= 16 && hour < 20) return 'evening';
        return null;
    }

    formatTime(date) {
        return date.toTimeString().slice(0, 5);
    }

    isTimeMatch(currentTime, scheduledTime) {
        const currentMinutes = this.timeToMinutes(currentTime);
        const scheduledMinutes = this.timeToMinutes(scheduledTime);
        return Math.abs(currentMinutes - scheduledMinutes) <= 3;
    }

    timeToMinutes(timeString) {
        const [hours, minutes] = timeString.split(':').map(Number);
        return hours * 60 + minutes;
    }

    playScheduledVideo(videoFileName) {
        console.log(`🎬 Playing video: ${videoFileName}`);

        this.isVideoPlaying = true;
        const videoURL = `${VIDEO_SERVER_URL}/videos/${videoFileName}`;
        const videoElement = document.getElementById('mainVideo');
        const videoPlayer = document.getElementById('videoPlayer');

        videoElement.onerror = () => {
            console.error('❌ Video playback error');
            this.stopVideo();
        };

        videoElement.src = videoURL;
        videoPlayer.style.display = 'flex';

        // Try to go fullscreen
        if (videoPlayer.requestFullscreen) {
            videoPlayer.requestFullscreen().catch(err => {
                console.log('⚠️ Fullscreen failed:', err.message);
            });
        }
    }

    stopVideo() {
        console.log('⏹️ Stopping video');

        const videoElement = document.getElementById('mainVideo');
        const videoPlayer = document.getElementById('videoPlayer');

        // Tear the source down properly so the decoded video buffer is
        // released. Setting `src = ''` resolves to the page URL (the element
        // would try to load the HTML page as a video and leak), so remove the
        // attribute and call load() to fully reset the element instead.
        videoElement.pause();
        videoElement.removeAttribute('src');
        videoElement.load();
        videoPlayer.style.display = 'none';
        this.isVideoPlaying = false;

        if (document.fullscreenElement) {
            document.exitFullscreen().catch(err => {
                console.log('⚠️ Exit fullscreen failed:', err.message);
            });
        }
    }

    requestFullscreen() {
        try {
            const docEl = document.documentElement;
            const requestMethod = docEl.requestFullscreen ||
                                docEl.mozRequestFullScreen ||
                                docEl.webkitRequestFullscreen ||
                                docEl.msRequestFullscreen;

            if (requestMethod) {
                requestMethod.call(docEl).catch(err => {
                    console.log('⚠️ Fullscreen failed:', err.message);
                });
            }
        } catch (error) {
            console.log('⚠️ Fullscreen error:', error.message);
        }
    }

    // ---- Display rotation ------------------------------------------------

    startRotation() {
        this.stopRotation();
        this.rotationIndex = 0;
        this.renderCurrentScreen();

        const seconds = Math.min(MAX_ROTATION_SECONDS, Math.max(MIN_ROTATION_SECONDS, this.rotationSeconds));
        this.rotationTimer = setInterval(() => this.rotationTick(), seconds * 1000);
        console.log(`🔁 Rotation started (${seconds}s per screen, ${this.rotationSequence.length} screens)`);
    }

    stopRotation() {
        if (this.rotationTimer) {
            clearInterval(this.rotationTimer);
            this.rotationTimer = null;
        }
    }

    rotationTick() {
        if (this.currentView !== 'display') return;
        // Pause the rotation while a scheduled video is taking over the screen.
        if (this.isVideoPlaying) return;

        this.rotationIndex = (this.rotationIndex + 1) % this.rotationSequence.length;
        this.renderCurrentScreen();
    }

    setRotationSeconds(value) {
        let seconds = parseInt(value, 10);
        if (isNaN(seconds)) seconds = DEFAULT_ROTATION_SECONDS;
        seconds = Math.min(MAX_ROTATION_SECONDS, Math.max(MIN_ROTATION_SECONDS, seconds));
        this.rotationSeconds = seconds;

        const input = document.getElementById('rotationSeconds');
        if (input) input.value = seconds;

        this.saveCalendarData();

        // Apply the new timing immediately if we're showing the display.
        if (this.currentView === 'display') {
            this.startRotation();
        }
    }

    getDateForDayIndex(index) {
        const date = new Date(this.selectedWeekStart);
        date.setDate(date.getDate() + index);
        return date;
    }

    formatMonthDay(date) {
        return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
    }

    eventHtml(index) {
        const text = this.events[index] || "No Event";
        return text.replace(/\n/g, '<br>');
    }

    renderCurrentScreen() {
        const body = document.getElementById('calendarBody');
        if (!body) return;

        const entry = this.rotationSequence[this.rotationIndex];
        if (!entry) return;

        if (entry.type === 'day') {
            body.innerHTML = this.renderDayScreenHTML(entry.day);
        } else if (entry.type === 'weekgrid') {
            body.innerHTML = this.renderWeekGridHTML();
        } else if (entry.type === 'weekend') {
            body.innerHTML = this.renderWeekendHTML();
        }
    }

    renderDayScreenHTML(dayKey) {
        const dayIndex = DAY_KEYS.indexOf(dayKey);
        const day = DAYS[dayIndex];
        const dateStr = this.formatMonthDay(this.getDateForDayIndex(dayIndex));

        const slots = day.indices.map((eventIndex, i) => `
            <div class="day-screen-slot">
                <div class="time-label">${TIMES_CAP[i]}</div>
                <div class="event-text">${this.eventHtml(eventIndex)}</div>
            </div>
        `).join('');

        return `
            <div class="day-screen">
                <div class="day-screen-title">${day.name}</div>
                <div class="day-screen-date">${dateStr}</div>
                <div class="day-screen-slots">${slots}</div>
            </div>
        `;
    }

    renderDayColumnHTML(dayKey) {
        const dayIndex = DAY_KEYS.indexOf(dayKey);
        const day = DAYS[dayIndex];
        const dateStr = this.formatMonthDay(this.getDateForDayIndex(dayIndex));

        const slots = day.indices.map((eventIndex, i) => `
            <div class="time-slot">
                <div class="time-label">${TIMES_CAP[i]}</div>
                <div class="event-text">${this.eventHtml(eventIndex)}</div>
            </div>
        `).join('');

        return `
            <div class="day-column">
                <div class="day-title">${day.name}</div>
                <div class="day-date">${dateStr}</div>
                ${slots}
            </div>
        `;
    }

    renderWeekGridHTML() {
        const columns = WEEKDAY_KEYS.map(key => this.renderDayColumnHTML(key)).join('');
        return `<div class="week-grid-screen">${columns}</div>`;
    }

    renderWeekendHTML() {
        const columns = ['sat', 'sun'].map(key => this.renderDayColumnHTML(key)).join('');
        return `<div class="weekend-screen">${columns}</div>`;
    }

    // ---- Views -----------------------------------------------------------

    toggleView() {
        if (this.isVideoPlaying) return;

        if (this.currentView === 'display') {
            this.switchToEditor();
        } else {
            this.switchToDisplay();
        }
    }

    switchToDisplay() {
        document.getElementById('displayView').style.display = 'flex';
        document.getElementById('editorView').style.display = 'none';
        this.currentView = 'display';
        this.startRotation();
    }

    switchToEditor() {
        this.stopRotation();
        document.getElementById('displayView').style.display = 'none';
        document.getElementById('editorView').style.display = 'flex';
        this.currentView = 'editor';
        this.updateInputs();
        this.switchTab(this.currentTab);
    }

    switchTab(tab) {
        this.currentTab = tab;
        const eventsTab = document.getElementById('eventsTab');
        const videosTab = document.getElementById('videosTab');
        const eventsEditor = document.getElementById('eventsEditorTab');
        const videoEditor = document.getElementById('videoEditorTab');
        const saveBtn = document.getElementById('saveBtn');
        const saveVideosBtn = document.getElementById('saveVideosBtn');

        if (tab === 'events') {
            eventsTab.classList.add('active');
            videosTab.classList.remove('active');
            eventsEditor.style.display = 'grid';
            videoEditor.style.display = 'none';
            saveBtn.style.display = 'inline-block';
            saveVideosBtn.style.display = 'none';
        } else {
            eventsTab.classList.remove('active');
            videosTab.classList.add('active');
            eventsEditor.style.display = 'none';
            videoEditor.style.display = 'flex';
            saveBtn.style.display = 'none';
            saveVideosBtn.style.display = 'inline-block';
        }
    }

    updateWeekDisplay() {
        DAY_KEYS.forEach((day, i) => {
            const date = this.getDateForDayIndex(i);
            const label = this.formatMonthDay(date);

            // Update editor view
            const editorDateEl = document.getElementById(`editor-date-${day}`);
            if (editorDateEl) editorDateEl.textContent = label;

            // Update video editor view
            const videoDateEl = document.getElementById(`video-date-${day}`);
            if (videoDateEl) videoDateEl.textContent = label;
        });

        // Update week dates display
        const weekDatesEl = document.getElementById('weekDates');
        if (weekDatesEl) {
            const startDate = this.getDateForDayIndex(0);
            const endDate = this.getDateForDayIndex(6);
            weekDatesEl.textContent = `${this.formatMonthDay(startDate)} - ${this.formatMonthDay(endDate)}, ${startDate.getFullYear()}`;
        }

        // Update week picker
        const weekPicker = document.getElementById('weekPicker');
        if (weekPicker) {
            const year = this.selectedWeekStart.getFullYear();
            const month = String(this.selectedWeekStart.getMonth() + 1).padStart(2, '0');
            const day = String(this.selectedWeekStart.getDate()).padStart(2, '0');
            weekPicker.value = `${year}-${month}-${day}`;
        }
    }

    // Re-renders whatever display screen is currently visible.
    updateDisplay() {
        this.renderCurrentScreen();
    }

    updateInputs() {
        for (let i = 0; i < 21; i++) {
            const input = document.getElementById(`input-${i}`);
            if (input) {
                input.value = this.events[i] === "No Event" ? "" : this.events[i];
            }
        }
    }

    // Builds the object persisted under the 'childLifeCalendar' storage key.
    buildCalendarData() {
        return {
            schemaVersion: SCHEMA_VERSION,
            events: this.events,
            month: this.currentMonth,
            qrVisible: this.qrCodeVisible,
            weekStart: this.selectedWeekStart.toISOString(),
            rotationSeconds: this.rotationSeconds
        };
    }

    saveCalendarData() {
        localStorage.setItem('childLifeCalendar', JSON.stringify(this.buildCalendarData()));
    }

    saveEvents() {
        for (let i = 0; i < 21; i++) {
            const input = document.getElementById(`input-${i}`);
            if (input) {
                this.events[i] = input.value || "No Event";
            }
        }

        this.saveCalendarData();
        alert('Calendar saved successfully!');
    }

    syncVideoScheduleToEvents() {
        console.log('🔄 Syncing video schedule to events...');

        // Map video schedule keys to event indices (all seven days).
        const slotToEventMap = {};
        DAYS.forEach(day => {
            TIMES.forEach((time, i) => {
                slotToEventMap[`${day.key}-${time}`] = day.indices[i];
            });
        });

        // Update events for each time slot that has videos
        Object.keys(slotToEventMap).forEach(slotKey => {
            const eventIndex = slotToEventMap[slotKey];
            const scheduledVideos = this.videoSchedule[slotKey];

            if (scheduledVideos && scheduledVideos.length > 0) {
                // Get current event text
                const currentText = this.events[eventIndex];

                // Build the video schedule text
                const videoLines = scheduledVideos.map(item => {
                    return `Channel 16: ${item.time} - ${item.video.replace(/\.\w+$/, '')}`;
                }).join('\n');

                // Check if current text already has video info
                const hasVideoInfo = currentText && currentText.includes('Channel 16:');

                if (!currentText || currentText === "No Event" || hasVideoInfo) {
                    // No manual text or only old video info - replace with new video schedule
                    this.events[eventIndex] = videoLines;
                } else {
                    // Has manual text - append videos below it
                    this.events[eventIndex] = `${currentText}\n\n${videoLines}`;
                }
            }
        });
    }

    saveVideoSchedule() {
        console.log('💾 Saving video schedule...');

        this.updateVideoSchedule();
        this.syncVideoScheduleToEvents(); // Add video info to event text

        const videoData = {
            schedule: this.videoSchedule,
            videoCounters: this.videoCounters
        };

        localStorage.setItem('childLifeVideoSchedule', JSON.stringify(videoData));

        // Also save the updated events
        this.saveCalendarData();

        this.updateDisplay(); // Refresh the display to show updated events
        alert('Video schedule saved successfully!');
    }

    loadFromStorage() {
        const savedData = localStorage.getItem('childLifeCalendar');
        if (savedData) {
            const data = JSON.parse(savedData);
            this.events = data.events || new Array(21).fill("No Event");
            this.currentMonth = data.month || 4;
            this.qrCodeVisible = data.qrVisible || false;
            this.rotationSeconds = data.rotationSeconds || DEFAULT_ROTATION_SECONDS;

            this.migrateLegacyData(data);

            if (data.weekStart) {
                this.selectedWeekStart = new Date(data.weekStart);
            }

            document.getElementById('monthSelect').value = this.currentMonth;
            const rotationInput = document.getElementById('rotationSeconds');
            if (rotationInput) rotationInput.value = this.rotationSeconds;

            this.applyMonthTheme(this.currentMonth);
            this.updateDisplay();
            this.updateInputs();
            this.updateQRCode();
            this.updateWeekDisplay();
        }

        const videoData = localStorage.getItem('childLifeVideoSchedule');
        if (videoData) {
            console.log('📼 Loading saved video schedule...');
            const data = JSON.parse(videoData);
            this.videoSchedule = data.schedule || {};
            this.videoCounters = data.videoCounters || {};
            this.initializeVideoCounters(); // ensure weekend slots exist
            this.loadVideoScheduleSelections();
        }
    }

    // Pre-v2 data stored a single "Weekend Events" blob at event index 20.
    // v2 splits the weekend into Sat/Sun Morning/Afternoon/Evening slots, where
    // index 20 is now Sunday-Evening. Preserve the old blob by moving it into
    // Saturday-Morning (index 15) so nothing is lost.
    migrateLegacyData(data) {
        if (data.schemaVersion >= SCHEMA_VERSION) return;

        const legacyWeekend = this.events[20];
        if (legacyWeekend && legacyWeekend !== "No Event") {
            if (!this.events[15] || this.events[15] === "No Event") {
                this.events[15] = legacyWeekend;
            }
            this.events[20] = "No Event";
            console.log('🔧 Migrated legacy weekend text into Saturday Morning slot');
        }

        // Persist the migrated, versioned data.
        this.saveCalendarData();
    }

    loadVideoScheduleSelections() {
        DAY_KEYS.forEach(day => {
            TIMES.forEach(time => {
                const key = `${day}-${time}`;
                const scheduledItems = this.videoSchedule[key];

                if (scheduledItems && scheduledItems.length > 0) {
                    const container = document.querySelector(`[data-slot="${key}"] .video-entries`);
                    if (container) {
                        container.innerHTML = '';

                        scheduledItems.forEach((item) => {
                            this.addVideoEntry(container, day, time, TIME_OPTIONS[time]);

                            const entries = container.querySelectorAll('.video-entry');
                            const lastEntry = entries[entries.length - 1];

                            if (lastEntry) {
                                const timeSelect = lastEntry.querySelector('.time-select');
                                const videoSelect = lastEntry.querySelector('.video-select');

                                if (timeSelect) timeSelect.value = item.time;
                                if (videoSelect) videoSelect.value = item.video;
                            }
                        });
                    }
                }
            });
        });
    }

    resetEvents() {
        if (confirm('Are you sure you want to reset all events and video schedules?')) {
            if (this.isVideoPlaying) {
                this.stopVideo();
            }

            this.events = new Array(21).fill("No Event");
            this.videoSchedule = {};
            this.videoCounters = {};
            this.initializeVideoCounters();

            this.updateDisplay();
            this.updateInputs();

            localStorage.removeItem('childLifeCalendar');
            localStorage.removeItem('childLifeVideoSchedule');

            location.reload();
        }
    }

    toggleQRCode() {
        this.qrCodeVisible = !this.qrCodeVisible;
        this.updateQRCode();
    }

    updateQRCode() {
        const qrCode = document.getElementById('qrCode');
        const button = document.getElementById('toggleQR');

        if (this.qrCodeVisible) {
            qrCode.classList.add('active');
            button.textContent = 'Turn QR Code off';
        } else {
            qrCode.classList.remove('active');
            button.textContent = 'Turn QR Code on';
        }
    }

    applyMonthTheme(monthNum) {
        const themes = {
            1: { header: '#66c7d5', body: '#33b4c7', name: 'JANUARY' },
            2: { header: '#6e2a46', body: '#6c1737', name: 'FEBRUARY' },
            3: { header: '#54c487', body: '#9ddba5', name: 'MARCH' },
            4: { header: '#76c2ef', body: '#e55a5c', name: 'APRIL' },
            5: { header: '#93d20e', body: '#fc9ccc', name: 'MAY' },
            6: { header: '#ff69b4', body: '#00c0c0', name: 'JUNE' },
            7: { header: '#d4242c', body: '#5083aa', name: 'JULY' },
            8: { header: '#599c51', body: '#a0cfc6', name: 'AUGUST' },
            9: { header: '#416371', body: '#e0aa30', name: 'SEPTEMBER' },
            10: { header: '#c23c1c', body: '#e6b274', name: 'OCTOBER' },
            11: { header: '#f9931b', body: '#efbc7c', name: 'NOVEMBER' },
            12: { header: '#d72a37', body: '#417052', name: 'DECEMBER' }
        };

        const theme = themes[monthNum];
        if (theme) {
            document.querySelector('.calendar-header').style.background = theme.header;
            document.querySelector('.calendar-body').style.background = theme.body;
            document.getElementById('monthTitle').textContent = theme.name;
        }
    }
}

// Self-heal watchdog for the always-on display.
// If an uncaught error or rejected promise ever slips through, reload the page
// automatically (after a short delay) instead of leaving a broken screen up
// until someone walks over and presses F5. The one-shot flag means we schedule
// at most one reload per page load, so a single hiccup can't spin into a tight
// reload loop.
let selfHealScheduled = false;
function scheduleSelfHeal(reason) {
    if (selfHealScheduled) return;
    selfHealScheduled = true;
    console.error('🩹 Self-heal: reloading display in 5s due to:', reason);
    setTimeout(() => location.reload(), 5000);
}
window.addEventListener('error', (e) => scheduleSelfHeal(e.message || 'window error'));
window.addEventListener('unhandledrejection', (e) => scheduleSelfHeal(e.reason || 'unhandled rejection'));

// Initialize when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ChildLifeCalendar();
});

// Register service worker
if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js')
        .then(() => console.log('✅ Service Worker registered'))
        .catch(err => console.warn('⚠️ Service Worker registration failed:', err));
}
