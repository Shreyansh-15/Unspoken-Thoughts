"use client";
import { useState, useEffect } from "react";

export default function Home() {
  const [thought, setThought] = useState("");
  const [mood, setMood] = useState("Calm 🌙");
  const [filter, setFilter] = useState("All");
  const [darkMode, setDarkMode] = useState(true);
  const [thoughts, setThoughts] = useState([]);

  useEffect(() => {
    const saved = localStorage.getItem("thoughts");
    if (saved) setThoughts(JSON.parse(saved));
  }, []);

  useEffect(() => {
    localStorage.setItem("thoughts", JSON.stringify(thoughts));
  }, [thoughts]);

  const addThought = () => {
    if (thought.trim() === "") return;

    const newThought = {
      text: thought,
      mood: mood,
      time: new Date().toLocaleString(),
    };

    setThoughts([...thoughts, newThought]);
    setThought("");
  };

  const deleteThought = (index) => {
    const newThoughts = thoughts.filter((_, i) => i !== index);
    setThoughts(newThoughts);
  };

  const filteredThoughts =
    filter === "All"
      ? thoughts
      : thoughts.filter((t) => t.mood === filter);

  return (
    <main
      className={`min-h-screen flex flex-col items-center p-6 transition ${
        darkMode
          ? "bg-gradient-to-b from-black to-gray-900 text-white"
          : "bg-gray-100 text-black"
      }`}
    >

      {/* Toggle */}
      <button
        onClick={() => setDarkMode(!darkMode)}
        className="self-end mb-4 px-4 py-1 rounded bg-yellow-400 text-black"
      >
        {darkMode ? "Light Mode ☀️" : "Dark Mode 🌙"}
      </button>

      <h1 className="text-5xl font-serif text-yellow-500">
        Unspoken Thoughts
      </h1>

      <p className="text-gray-500 mt-2">
        Write what you can't say aloud.
      </p>

      <div className="bg-gray-800/70 p-6 rounded-xl shadow-lg mt-8 w-80">

        <textarea
          placeholder="Let your thoughts flow..."
          value={thought}
          onChange={(e) => setThought(e.target.value)}
          className="w-full h-24 p-3 rounded text-black"
        />

        <select
          value={mood}
          onChange={(e) => setMood(e.target.value)}
          className="w-full mt-3 p-2 rounded text-black"
        >
          <option>Calm 🌙</option>
          <option>Happy ☀️</option>
          <option>Sad 🌧</option>
          <option>Anxious 🌫</option>
        </select>

        <button
          onClick={addThought}
          className="mt-4 w-full bg-yellow-500 text-black py-2 rounded-lg"
        >
          Save Thought
        </button>

      </div>

      <select
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        className="mt-6 p-2 rounded text-black"
      >
        <option>All</option>
        <option>Calm 🌙</option>
        <option>Happy ☀️</option>
        <option>Sad 🌧</option>
        <option>Anxious 🌫</option>
      </select>

      <div className="mt-6 space-y-4 w-80">
        {filteredThoughts.map((t, i) => (
          <div
            key={i}
            className="bg-gray-700/80 p-4 rounded-lg shadow-md"
          >
            <p>{t.text}</p>
            <p className="text-sm text-yellow-400">{t.mood}</p>
            <p className="text-xs text-gray-400">{t.time}</p>

            <button
              onClick={() => deleteThought(i)}
              className="text-red-400 text-sm mt-2"
            >
              Delete
            </button>
          </div>
        ))}
      </div>

    </main>
  );
}
