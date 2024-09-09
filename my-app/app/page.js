'use client'
import React, { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [file1, setFile1] = useState(null);
  const [file2, setFile2] = useState(null);
  const [merging, setMerging] = useState(false);
  const [error, setError] = useState('');

  const handleFileChange = (event, setFile) => {
    const file = event.target.files[0];
    if (file && file.type.startsWith('audio/')) {
      setFile(file);
      setError('');
    } else {
      setError('Please select a valid audio file.');
      setFile(null);
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!file1 || !file2) {
      setError('Please select two audio files.');
      return;
    }

    setMerging(true);
    setError('');

    const formData = new FormData();
    formData.append('audio', file1);
    formData.append('audio', file2);

    try {
      const response = await axios.post('http://localhost:5001/mix', formData, {
        responseType: 'blob',
      });

      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', 'merged.aac');
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      setError('An error occurred while merging the audio files.');
      console.error('Error:', error);
    } finally {
      setMerging(false);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Audio File Merger (AAC)</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="file1" className="block mb-2">Audio File 1:</label>
          <input
            type="file"
            id="file1"
            accept="audio/*"
            onChange={(e) => handleFileChange(e, setFile1)}
            className="border p-2 w-full"
          />
        </div>
        <div>
          <label htmlFor="file2" className="block mb-2">Audio File 2:</label>
          <input
            type="file"
            id="file2"
            accept="audio/*"
            onChange={(e) => handleFileChange(e, setFile2)}
            className="border p-2 w-full"
          />
        </div>
        {error && <p className="text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={merging || !file1 || !file2}
          className="bg-blue-500 text-white px-4 py-2 rounded disabled:bg-gray-400"
        >
          {merging ? 'Merging...' : 'Merge Audio Files'}
        </button>
      </form>
    </div>
  );
}