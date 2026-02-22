✨ Unspoken Thoughts

A Privacy-First Emotional Journaling Platform

Write. Breathe. Save what matters. Release what doesn’t.

Unspoken Thoughts is a full-stack journaling application built with Next.js + Firebase that combines emotional tracking, privacy systems, and real-time cloud syncing into a clean, minimal experience.

It is designed as both:
	•	A strong portfolio-grade internship project
	•	A scalable foundation for a real mental wellness product

⸻

🚀 Live Demo

🔗 https://your-vercel-link.vercel.app

⸻

🧠 Product Philosophy

Unspoken Thoughts is built around three principles:

1. Privacy by Default

Your thoughts belong to you.

2. Emotional Awareness

Track patterns, not just entries.

3. Minimalism with Depth

Simple interface. Powerful system.

⸻

✨ Core Features

🔐 Secure Authentication
	•	Email & Password login
	•	Google OAuth
	•	Firebase Authentication
	•	Per-user Firestore data isolation

⸻

📝 Journaling Engine
	•	Create, edit, delete thoughts
	•	500-character limit (intentional brevity)
	•	Mood tagging system
	•	Real-time cloud sync
	•	Archive (hide without deleting)
	•	Pin important entries
	•	Gentle “Release” delete animation
	•	Permanent delete confirmation

⸻

📊 Emotional Intelligence System

Mood Insights
	•	Dynamic real-time mood bar chart
	•	Filter-aware calculations
	•	Visual emotional breakdown

14-Day Mood Tracker
	•	Displays latest mood per day
	•	Emoji-based timeline visualization
	•	Helps identify emotional trends

⸻

🔥 Writing Streak System
	•	Tracks consecutive writing days
	•	Stored locally for speed
	•	Auto-updates on save
	•	Encourages daily reflection

⸻

🧘 Guided Reflection Tools
	•	Deterministic daily prompts
	•	Quick-start writing templates
	•	Mood-based reflection messages

⸻

🔐 Advanced Privacy Layer (Level 16)

Beyond authentication:
	•	Device-level PIN lock
	•	Auto-lock timer
	•	Lock on tab switch
	•	Blur when tab hidden
	•	Manual lock control
	•	All PIN data stored locally only

This mimics mobile banking-level UX privacy.

⸻

🌍 Anonymous Public Feed (Optional)

Users may:
	•	Share a thought anonymously
	•	Use a custom anonymous name
	•	View a real-time public support feed
	•	Report inappropriate content
	•	Delete their own shared posts

Public feed stored in a separate Firestore collection for security isolation.

⸻

📦 Data Portability

Users can export all thoughts as:
	•	JSON backup
	•	Plain text file

Ensuring ownership and portability of personal data.

⸻

📡 Online Awareness
	•	Real-time Online / Offline status indicator
	•	Uses browser API
	•	Visual feedback for sync awareness

⸻

🎨 Design System
	•	Custom CSS (no UI framework)
	•	Glassmorphism card system
	•	Gradient-based accent system
	•	Mood-based color accents
	•	Dark Mode (default)
	•	Soft pastel Light Mode (Apple Notes inspired)
	•	Responsive layout
	•	Background image support

⸻

🛠 Tech Stack

Frontend
	•	Next.js (App Router)
	•	React Hooks
	•	Custom CSS architecture

Backend
	•	Firebase Authentication
	•	Firebase Firestore (real-time)
	•	Firestore Security Rules

Deployment
	•	Vercel (CI/CD via GitHub)

📂 Firestore Architecture

Collection: thoughts
{
  "uid": "string",
  "text": "string",
  "mood": "string",
  "createdAt": "timestamp",
  "archived": "boolean",
  "pinned": "boolean"
}

Collection: publicThoughts
{
  "text": "string",
  "mood": "string",
  "createdAt": "timestamp",
  "ownerUid": "string",
  "anonName": "string",
  "reportCount": "number"
}

🔧 Local Setup
git clone https://github.com/your-username/unspoken-thoughts.git
cd unspoken-thoughts
npm install

Create .env.local:
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

Run locally:
npm run dev

📱 PWA Support
	•	Installable on Android
	•	Add to Home Screen compatible
	•	Service Worker enabled
	•	Offline-aware UI

⸻

📈 Scalability Vision

Future roadmap:
	•	Mood heatmap calendar
	•	AI-assisted reflection summaries
	•	Emotional trend analytics dashboard
	•	Moderation pipeline for public feed
	•	Mobile wrapper (React Native / Expo)
	•	Cloud backup encryption layer

⸻

💡 What This Project Demonstrates
	•	Full-stack architecture
	•	Real-time database management
	•	Authentication & data isolation
	•	UX-level privacy engineering
	•	State management & React hooks mastery
	•	Production deployment workflow
	•	Clean UI system design


👨‍💻 Author

Shreyansh Gupta
Full-Stack Developer (In Progress 🚀)