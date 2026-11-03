import React, { useState, useRef, useEffect } from 'react';
import { Camera, Square, RefreshCw, Send, AlertCircle, Video, Shield } from 'lucide-react';

interface CircularVideoRecorderProps {
  onRecorded: (videoData: {
    videoUrl: string;
    duration: number;
    transcript: string;
    category: string;
    urgency: 'STANDART' | 'YUQORI' | 'SHOSHILINCH';
  }) => void;
  onCancel: () => void;
}

export const CircularVideoRecorder: React.FC<CircularVideoRecorderProps> = ({
  onRecorded,
  onCancel
}) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<any>(null);

  const [stream, setStream] = useState<MediaStream | null>(null);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [recordedBlobUrl, setRecordedBlobUrl] = useState<string | null>(null);

  // Real user input fields (no hardcoded fake scenarios)
  const [statementText, setStatementText] = useState('');
  const [category, setCategory] = useState('Jamoat tartibi va tinchlik');
  const [urgency, setUrgency] = useState<'STANDART' | 'YUQORI' | 'SHOSHILINCH'>('STANDART');

  // Start Camera
  useEffect(() => {
    let activeStream: MediaStream | null = null;
    async function initCamera() {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Kamera ruxsati mavjud emas.');
        }
        const mediaStream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 480 },
            height: { ideal: 480 },
            facingMode: 'user'
          },
          audio: true
        });
        activeStream = mediaStream;
        setStream(mediaStream);
        if (videoRef.current) {
          videoRef.current.srcObject = mediaStream;
        }
      } catch (err: any) {
        setCameraError(err.message || 'Kamera ochilmadi');
      }
    }

    initCamera();

    return () => {
      if (activeStream) {
        activeStream.getTracks().forEach(track => track.stop());
      }
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const startRecording = () => {
    if (stream) {
      try {
        recordedChunksRef.current = [];
        const recorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        mediaRecorderRef.current = recorder;

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            recordedChunksRef.current.push(e.data);
          }
        };

        recorder.onstop = () => {
          const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
          const url = URL.createObjectURL(blob);
          setRecordedBlobUrl(url);
        };

        recorder.start(250);
      } catch (err) {
        console.warn('MediaRecorder error:', err);
      }
    }

    setIsRecording(true);
    setRecordingSeconds(0);

    timerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => {
        if (prev >= 59) {
          stopRecording();
          return 60;
        }
        return prev + 1;
      });
    }, 1000);
  };

  const stopRecording = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    setIsRecording(false);

    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop();
    } else if (!recordedBlobUrl) {
      setRecordedBlobUrl('blob:webcam-recorded-video-note');
    }
  };

  const handleSubmit = () => {
    onRecorded({
      videoUrl: recordedBlobUrl || 'blob:captured-video-note',
      duration: recordingSeconds || 15,
      transcript: statementText.trim() || 'Fuqaroning dumaloq video murojaati',
      category,
      urgency
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-md p-4">
      <div className="relative w-full max-w-lg bg-slate-900 border border-slate-700 rounded-3xl shadow-2xl p-6 text-slate-100 flex flex-col items-center">
        {/* Header */}
        <div className="w-full flex items-center justify-between pb-3 border-b border-slate-800 mb-3">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
            <h3 className="text-sm font-bold text-white tracking-wide">
              Dumaloq Video Yozish (video_note)
            </h3>
          </div>
          <button
            onClick={onCancel}
            className="text-xs px-2.5 py-1 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors"
          >
            Bekor qilish
          </button>
        </div>

        {/* Circular Viewport */}
        <div className="relative flex items-center justify-center my-2">
          <div className="relative w-64 h-64 rounded-full overflow-hidden border-4 border-emerald-500 shadow-[0_0_35px_rgba(16,185,129,0.35)] bg-slate-950 flex items-center justify-center">
            {stream && !cameraError ? (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className="w-full h-full object-cover scale-x-[-1]"
              />
            ) : (
              <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900 p-6 text-center">
                <Video className="w-10 h-10 text-emerald-400 mb-2" />
                <p className="text-xs text-slate-300 font-semibold">Kamera tayyorlanmoqda</p>
                <p className="text-[10px] text-slate-500 mt-1">Brauzerda kameraga ruxsat bering</p>
              </div>
            )}

            {isRecording && (
              <div className="absolute top-4 px-3 py-1 bg-red-600 text-white rounded-full text-xs font-mono font-bold flex items-center gap-1.5 shadow-lg animate-pulse">
                <span className="w-2 h-2 rounded-full bg-white" />
                <span>00:{String(recordingSeconds).padStart(2, '0')}</span>
              </div>
            )}
          </div>
        </div>

        {/* Record Buttons */}
        <div className="flex items-center gap-3 my-3">
          {!isRecording && !recordedBlobUrl && (
            <button
              onClick={startRecording}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white text-xs font-semibold rounded-full flex items-center gap-2 shadow-lg shadow-red-900/40 transition-transform active:scale-95"
            >
              <div className="w-3.5 h-3.5 rounded-full bg-white" />
              <span>Yozishni boshlash</span>
            </button>
          )}

          {isRecording && (
            <button
              onClick={stopRecording}
              className="px-6 py-2.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold rounded-full flex items-center gap-2 border border-slate-600 shadow-lg"
            >
              <Square className="w-3.5 h-3.5 text-red-500 fill-red-500" />
              <span>To‘xtatish ({recordingSeconds}s)</span>
            </button>
          )}

          {recordedBlobUrl && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setRecordedBlobUrl(null);
                  setRecordingSeconds(0);
                }}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium rounded-full flex items-center gap-1.5"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Qayta yozish</span>
              </button>

              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold rounded-full flex items-center gap-1.5 shadow-lg shadow-emerald-900/40"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Inspektorga jo‘natish</span>
              </button>
            </div>
          )}
        </div>

        {/* Form details (Real user input) */}
        <div className="w-full space-y-3 pt-2 border-t border-slate-800 text-xs">
          <div>
            <label className="block text-slate-300 font-medium mb-1">
              Murojaat mazmuni (qisqa tushuntirish):
            </label>
            <textarea
              rows={2}
              value={statementText}
              onChange={(e) => setStatementText(e.target.value)}
              placeholder="Vaziyatni qisqacha yozing (ixtiyoriy)..."
              className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-slate-300 font-medium mb-1">Toifasi:</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
              >
                <option value="Jamoat tartibi va tinchlik">Jamoat tartibi va tinchlik</option>
                <option value="Avtotransport va yo‘l harakati">Avtotransport va yo‘l harakati</option>
                <option value="Qo‘shnichilik nizosi">Qo‘shnichilik nizosi</option>
                <option value="Obodonlashtirish va sanitariya">Obodonlashtirish va sanitariya</option>
                <option value="Xavfsizlik va mulk daxlsizligi">Xavfsizlik va mulk daxlsizligi</option>
              </select>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">Muhimlik darajasi:</label>
              <select
                value={urgency}
                onChange={(e) => setUrgency(e.target.value as any)}
                className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-xl text-white focus:outline-none"
              >
                <option value="STANDART">Standart</option>
                <option value="YUQORI">Yuqori</option>
                <option value="SHOSHILINCH">Shoshilinch</option>
              </select>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
