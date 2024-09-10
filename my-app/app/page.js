// app/page.js
'use client';

import React, { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [backgroundAudio, setBackgroundAudio] = useState(null);
  const [realAudio, setRealAudio] = useState(null);
  const [processing, setProcessing] = useState(false);
  const [downloadLink, setDownloadLink] = useState(null);
  const [error, setError] = useState(null);

  const handleFileChange = (event, fileType) => {
    if (event.target.files) {
      if (fileType === 'background') {
        setBackgroundAudio(event.target.files[0]);
      } else {
        setRealAudio(event.target.files[0]);
      }
    }
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!backgroundAudio || !realAudio) {
      setError('Please select both background and real audio files.');
      return;
    }

    setProcessing(true);
    setError(null);
    setDownloadLink(null);

    const formData = new FormData();
    formData.append('audio', backgroundAudio);
    formData.append('audio', realAudio);

    try {
      const response = await axios.post('http://localhost:5001/process', formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      setDownloadLink(`http://localhost:5001${response.data.downloadUrl}`);
    } catch (error) {
      setError('An error occurred while processing the audio files.');
      console.error('Error:', error);
    } finally {
      setProcessing(false);
    }
  };

  const handleDownload = () => {
    if (downloadLink) {
      window.location.href = downloadLink;
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 py-6 flex flex-col justify-center sm:py-12">
      <div className="relative py-3 sm:max-w-xl sm:mx-auto">
        <div className="relative px-4 py-10 bg-white mx-8 md:mx-0 shadow rounded-3xl sm:p-10">
          <div className="max-w-md mx-auto">
            <div className="flex items-center space-x-5">
              <div className="h-14 w-14 bg-yellow-200 rounded-full flex flex-shrink-0 justify-center items-center text-yellow-500 text-2xl font-mono">i</div>
              <div className="block pl-2 font-semibold text-xl self-start text-gray-700">
                <h2 className="leading-relaxed">Audio Processing</h2>
                <p className="text-sm text-gray-500 font-normal leading-relaxed">
                  Upload background and real audio files to process and merge.
                </p>
              </div>
            </div>
            <form onSubmit={handleSubmit} className="divide-y divide-gray-200">
              <div className="py-8 text-base leading-6 space-y-4 text-gray-700 sm:text-lg sm:leading-7">
                <div className="flex flex-col">
                  <label className="leading-loose">Background Audio</label>
                  <input 
                    type="file" 
                    accept="audio/*" 
                    onChange={(e) => handleFileChange(e, 'background')} 
                    className="px-4 py-2 border focus:ring-gray-500 focus:border-gray-900 w-full sm:text-sm border-gray-300 rounded-md focus:outline-none text-gray-600" 
                  />
                </div>
                <div className="flex flex-col">
                  <label className="leading-loose">Real Audio</label>
                  <input 
                    type="file" 
                    accept="audio/*" 
                    onChange={(e) => handleFileChange(e, 'real')} 
                    className="px-4 py-2 border focus:ring-gray-500 focus:border-gray-900 w-full sm:text-sm border-gray-300 rounded-md focus:outline-none text-gray-600" 
                  />
                </div>
              </div>
              <div className="pt-4 flex items-center space-x-4">
                <button 
                  type="submit" 
                  disabled={processing} 
                  className="bg-blue-500 flex justify-center items-center w-full text-white px-4 py-3 rounded-md focus:outline-none"
                >
                  {processing ? 'Processing...' : 'Process Audio'}
                </button>
              </div>
            </form>
            {error && (
              <div className="mt-4 text-red-500">{error}</div>
            )}
            {downloadLink && (
              <div className="mt-4">
                <button 
                  onClick={handleDownload} 
                  className="bg-green-500 text-white px-4 py-2 rounded-md hover:bg-green-600 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50"
                >
                  Download Processed Audio
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}