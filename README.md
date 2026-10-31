# English Teaching Platform

A small web platform for teaching English to private students. The teacher builds lessons and decides, student by student, which ones are unlocked and in what order. Students type their name and get access to their own lessons, with interactive questions built into each one.

Built with Node.js, Express, SQLite and plain HTML/CSS/JavaScript. There is no build step and no front-end framework.

## Features

**For students**
- Enter with just a name (no password or PIN)
- See only the lessons the teacher has unlocked for them, in the teacher's order
- Lessons grouped under section headers
- Search bar to filter lessons by title (ignores capitals and accents)
- Interactive lesson blocks that reset every time a lesson is opened:
  - Text and explanations
  - Multiple choice questions that show the correct answer and an optional explanation once an option is picked
  - Open-ended questions with a written answer
  - Hidden text that is revealed on click

**For the teacher**
- Password-protected panel at `/teacher.html`
- Add and remove students
- Block-based lesson editor: mix and reorder text, multiple choice, open questions and hidden text
- Per-student lesson management: add or remove lessons, reorder them with arrow buttons, and add section headers
- Scrollable lists with search for students, lessons and locked lessons
- Student answers are logged in the server terminal and in the student's browser console

## Planned

- Save answers and quiz attempts in the database and review them in the teacher panel
- Bookmarks for students
- Enrichment archive: extra links, quizzes and activities assigned to individual students, separate from the class lessons

## Getting started

### Requirements

- [Node.js](https://nodejs.org) (current LTS version)

### Installation

```bash
git clone <your-repository-url>
cd english-platform
npm install
```

### Configuration

Create a `.env` file in the project root:

```
PORT=3000
TEACHER_PASSWORD=choose-a-strong-password
```

### Run

```bash
npm run dev     # development, restarts automatically when files change
npm start       # normal start
```

On Windows you can also double-click `start-server.bat`, which starts the server and opens the browser.

Then open:

| Page | URL |
| --- | --- |
| Student entry | http://localhost:3000 |
| Teacher panel | http://localhost:3000/teacher.html |

The SQLite database (`db/data.sqlite`) is created automatically on first run.

### First steps

1. Open the teacher panel and log in with `TEACHER_PASSWORD`.
2. Add a student, for example "Maria".
3. Create a lesson with the block editor.
4. Select the student, then click **Add** next to the lesson in the Locked list.
5. Open the student page, type the name, and the lesson appears.

## Project structure

```
english-platform/
├─ server.js              # Express server entry point
├─ start-server.bat       # Windows shortcut to start the server
├─ .env                   # Port and teacher password (not committed)
├─ db/
│  ├─ schema.sql          # Table definitions, applied on every start
│  ├─ db.js               # Opens the database and runs migrations
│  └─ data.sqlite         # Created automatically (not committed)
├─ routes/
│  ├─ teacher.js          # Teacher API (login, students, lessons, unlocks, headers)
│  └─ student.js          # Student API (enter, lesson list, lesson content, answers)
└─ public/
   ├─ index.html          # Student name entry
   ├─ student.html        # Student lesson view
   ├─ teacher.html        # Teacher panel
   ├─ css/style.css
   └─ js/
      ├─ enter.js
      ├─ student.js
      └─ teacher.js
```

## How it works

**Data.** The database has these tables: `students`, `lessons`, `unlocks` (which lessons each student can see, with a per-student `position`) and `headers` (per-student section headings that share the same ordering as lessons).

**Lessons.** A lesson's content is stored as a JSON array of blocks in the `body` column. Older lessons that contain plain text or HTML are treated as a single text block.

**Access control.** Locked lessons are enforced on the server. A student requesting a lesson that is not unlocked for them receives a 403 response, even if they know the lesson's URL.

**Teacher login.** The teacher logs in with the password from `.env` and receives a token kept in server memory. Restarting the server logs the teacher out.

## API overview

All teacher routes except `/login` require an `x-teacher-token` header. All student routes except `/enter` require an `x-student-id` header.

| Method | Route | Purpose |
| --- | --- | --- |
| POST | `/api/teacher/login` | Log in with the teacher password |
| GET, POST, DELETE | `/api/teacher/students` | List, add and remove students |
| GET, POST, PUT, DELETE | `/api/teacher/lessons` | Manage lessons |
| GET, POST | `/api/teacher/students/:id/unlocks` | List a student's items in order, unlock a lesson |
| DELETE | `/api/teacher/students/:id/unlocks/:lessonId` | Lock a lesson again |
| POST, PUT, DELETE | `/api/teacher/students/:id/headers` | Manage section headers |
| PUT | `/api/teacher/students/:id/unlock-order` | Save a new order for lessons and headers |
| POST | `/api/student/enter` | Find a student by name |
| GET | `/api/student/lessons` | The student's unlocked lessons and headers |
| GET | `/api/student/lessons/:id` | One unlocked lesson |
| POST | `/api/student/answers` | Log an answer in the server console |

## Security notes

This project is designed for a small group of private students, and some choices reflect that:

- Students sign in with a name only. Anyone who knows or guesses a name can open that student's lessons. Do not store sensitive information in lessons.
- Lesson text and hidden text are inserted as HTML. Only the teacher can write them, so they are trusted.
- Correct answers for multiple choice questions are sent to the student's browser so feedback can appear instantly. A student using developer tools could see them. This is fine for practice, but not for graded tests.
- Use a strong `TEACHER_PASSWORD`, and serve the site over HTTPS if you host it on the internet.

## Deployment

Any host that can run Node.js works, as long as it has a persistent disk for the SQLite file. Set the `PORT` and `TEACHER_PASSWORD` environment variables on the host. Back up `db/data.sqlite` regularly.

## License

Add a license of your choice (for example MIT) before publishing.
