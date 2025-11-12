'use client';

import { useState, useEffect, useRef } from 'react';

interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLang: string;
  targetLang: string;
  timestamp: number;
}

export default function Home() {
  const [meetingUrl, setMeetingUrl] = useState('');
  const [isConnected, setIsConnected] = useState(false);
  const [isMeetingActive, setIsMeetingActive] = useState(false);
  const [translations, setTranslations] = useState<TranslationResult[]>([]);
  const [status, setStatus] = useState('未接続');
  const wsRef = useRef<WebSocket | null>(null);

  // WebSocket接続
  const connectWebSocket = () => {
    const ws = new WebSocket('ws://localhost:3001');

    ws.onopen = () => {
      console.log('WebSocket connected');
      setIsConnected(true);
      setStatus('接続済み');
    };

    ws.onmessage = (event) => {
      const message = JSON.parse(event.data);
      console.log('Received:', message);

      switch (message.type) {
        case 'connected':
          setStatus('サーバーに接続しました');
          break;

        case 'meeting_started':
          setIsMeetingActive(true);
          setStatus('会議に参加しました');
          break;

        case 'meeting_stopped':
          setIsMeetingActive(false);
          setStatus('会議から退出しました');
          break;

        case 'translations':
          setTranslations((prev) => [...prev, ...message.data]);
          break;

        case 'subtitles':
          // 字幕表示の処理
          console.log('Subtitles:', message.data);
          break;

        case 'error':
          setStatus(`エラー: ${message.error}`);
          break;

        default:
          console.log('Unknown message type:', message.type);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
      setStatus('接続エラー');
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
      setIsConnected(false);
      setStatus('切断されました');
    };

    wsRef.current = ws;
  };

  // 会議開始
  const startMeeting = () => {
    if (!wsRef.current || !meetingUrl) return;

    const config = {
      meetingUrl,
      targetLanguages: ['zh-Hant-TW', 'fr'],
      enableVoice: true,
      enableSubtitles: true,
    };

    wsRef.current.send(
      JSON.stringify({
        type: 'start_meeting',
        config,
      })
    );

    setTranslations([]);
  };

  // 会議停止
  const stopMeeting = () => {
    if (!wsRef.current) return;

    wsRef.current.send(
      JSON.stringify({
        type: 'stop_meeting',
      })
    );
  };

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-8">
      <div className="max-w-6xl mx-auto">
        <header className="mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2">
            Google Meet 多言語リアルタイム翻訳
          </h1>
          <p className="text-gray-600">
            日本語 ⇄ 台湾華語 ⇄ フランス語のリアルタイム翻訳エージェント
          </p>
        </header>

        {/* 接続状態 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-xl font-semibold mb-2">接続状態</h2>
              <p className="text-gray-600">{status}</p>
            </div>
            <div>
              {!isConnected ? (
                <button
                  onClick={connectWebSocket}
                  className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-6 rounded-lg transition"
                >
                  サーバーに接続
                </button>
              ) : (
                <div className="flex items-center">
                  <div className="w-3 h-3 bg-green-500 rounded-full mr-2 animate-pulse"></div>
                  <span className="text-green-600 font-semibold">接続中</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 会議設定 */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4">会議設定</h2>
          <div className="flex gap-4">
            <input
              type="text"
              value={meetingUrl}
              onChange={(e) => setMeetingUrl(e.target.value)}
              placeholder="Google Meet URL を入力"
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              disabled={!isConnected || isMeetingActive}
            />
            {!isMeetingActive ? (
              <button
                onClick={startMeeting}
                disabled={!isConnected || !meetingUrl}
                className="bg-green-500 hover:bg-green-600 disabled:bg-gray-300 text-white font-bold py-2 px-6 rounded-lg transition"
              >
                会議に参加
              </button>
            ) : (
              <button
                onClick={stopMeeting}
                className="bg-red-500 hover:bg-red-600 text-white font-bold py-2 px-6 rounded-lg transition"
              >
                会議から退出
              </button>
            )}
          </div>
        </div>

        {/* 翻訳結果 */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-xl font-semibold mb-4">翻訳結果</h2>
          <div className="space-y-4 max-h-96 overflow-y-auto">
            {translations.length === 0 ? (
              <p className="text-gray-400 text-center py-8">
                翻訳結果がここに表示されます
              </p>
            ) : (
              translations.map((translation, index) => (
                <div
                  key={index}
                  className="border-l-4 border-blue-500 bg-gray-50 p-4 rounded"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-semibold text-gray-600">
                      {translation.sourceLang} → {translation.targetLang}
                    </span>
                    <span className="text-xs text-gray-400">
                      {new Date(translation.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-gray-700 mb-2">{translation.originalText}</p>
                  <p className="text-blue-600 font-medium">
                    {translation.translatedText}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
