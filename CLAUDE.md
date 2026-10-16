# CCTV Scheduler 2026

Digital-signage calendars for hospital TVs: a weekly events calendar plus scheduled kids' videos. Plain HTML/CSS/JS with no build step, served by a PowerShell `HttpListener` server (`video-server.ps1`).

## Layout

The repo holds two independent copies of the same app:

| Folder | Audience | Main page | Port | Saved-data keys |
|---|---|---|---|---|
| `Child Life Calendar/` | Child Life (original) | `Child Life Calendar.html` | 8080 | `childLifeCalendar`, `childLifeVideoSchedule` |
| `NICU Events Scheduler/` | NICU | `NICU_Events_Calendar.html` | 8081 | `nicuEventsCalendar`, `nicuEventsVideoSchedule` |

Start either app with its `START-SERVER-SIMPLE.bat`, then open `http://localhost:<port>/`. Press **Esc** on the page to toggle the editor.

## Rules

- **Keep the two apps independent.** This PC is a test machine that runs both side by side, so the separate ports and saved-data keys must stay. Don't merge them back to one port.
- **When working on NICU, don't touch the Child Life files** unless asked.
- **Don't commit or push unless asked.** After a batch of changes, suggest it and wait.
- **Push as `gameaccgts-ngts`.** This PC's default GitHub login is a different account, so a plain `git push` fails or hangs. Use the stored `gh` login instead:
  `git -c credential.helper= -c 'credential.helper=!f() { echo username=gameaccgts-ngts; echo password=$(gh auth token -u gameaccgts-ngts); }; f' push`

## Things to know

- `videos/` folders are gitignored (`**/videos/*.mp4` and friends) because the files exceed GitHub's 100 MB limit. Copy them onto a new machine by hand.
- Weekly Word calendars (`*.docx`) are inputs, not code, and are gitignored too.
- The display PCs are kept offline. Each week the Word calendar is turned into `calendar-data.json` with `tools/calendar-converter.html`, carried over on a drive, and imported once by `json-loader.js`.
- The NICU converter is still the Child Life one. It needs rebuilding once there is a sample NICU calendar.
