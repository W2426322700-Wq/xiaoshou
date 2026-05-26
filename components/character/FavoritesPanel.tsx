import React, { useState, useRef, useEffect } from 'react';
import { FavoritedMessage } from '../../types';
import { DB } from '../../utils/db';

interface FavoritesPanelProps {
    favorites: FavoritedMessage[];
    onDelete: (id: string) => void;
}

const FavoritesPanel: React.FC<FavoritesPanelProps> = ({ favorites, onDelete }) => {
    const [playingId, setPlayingId] = useState<string | null>(null);
    const audioRef = useRef<HTMLAudioElement | null>(null);
    const blobUrlsRef = useRef<Set<string>>(new Set());

    // Stop audio on unmount and revoke blobs
    useEffect(() => {
        const urls = blobUrlsRef.current;
        return () => {
            if (audioRef.current) {
                audioRef.current.pause();
                audioRef.current = null;
            }
            urls.forEach(u => { try { URL.revokeObjectURL(u); } catch { /* ignore */ } });
            urls.clear();
        };
    }, []);

    const handlePlayVoice = async (fav: FavoritedMessage) => {
        if (playingId === fav.id) {
            if (audioRef.current) {
                audioRef.current.pause();
                setPlayingId(null);
            }
            return;
        }

        try {
            const assetKey = `voice_msg_${fav.messageId}`;
            const stored = await DB.getAssetRaw(assetKey) as any;
            let url: string | null = null;
            
            if (stored) {
                if (stored.blob instanceof Blob) {
                    url = URL.createObjectURL(stored.blob);
                    blobUrlsRef.current.add(url);
                } else if (stored.remoteUrl) {
                    url = stored.remoteUrl;
                }
            }

            if (!url) {
                alert("未找到语音缓存，可能已被清理");
                return;
            }

            if (!audioRef.current) {
                audioRef.current = new Audio();
                audioRef.current.onended = () => setPlayingId(null);
                audioRef.current.onerror = () => {
                    setPlayingId(null);
                    alert("语音播放失败");
                };
            }

            audioRef.current.src = url;
            audioRef.current.play().catch(() => setPlayingId(null));
            setPlayingId(fav.id);
        } catch (e) {
            console.error("Failed to play voice", e);
            setPlayingId(null);
        }
    };

    const renderContent = (fav: FavoritedMessage) => {
        const text = fav.content || '';
        const bilingualIdx = text.toLowerCase().indexOf('%%bilingual%%');
        
        if (bilingualIdx !== -1) {
            const langA = text.substring(0, bilingualIdx).trim();
            const langB = text.substring(bilingualIdx + '%%bilingual%%'.length).trim();
            // Handle voice tags in text (e.g., <语音>...</语音>)
            const cleanLangA = langA.replace(/<[语語]音>[\s\S]*?<\/[语語]音>/g, '').trim() || langA;
            const cleanLangB = langB.replace(/<[语語]音>[\s\S]*?<\/[语語]音>/g, '').trim() || langB;

            return (
                <div className="flex flex-col gap-1.5">
                    <div className="text-slate-700 text-sm leading-relaxed font-medium">{cleanLangA}</div>
                    <div className="text-slate-500 text-xs leading-relaxed">{cleanLangB}</div>
                </div>
            );
        }
        
        const cleanText = text.replace(/<[语語]音>[\s\S]*?<\/[语語]音>/g, '').trim() || text;
        return <div className="text-slate-700 text-sm leading-relaxed">{cleanText}</div>;
    };

    return (
        <div className="space-y-3 animate-fade-in">
            {favorites.length === 0 ? (
                <div className="text-center py-10 text-slate-400 text-xs bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                    暂无收藏的消息
                </div>
            ) : (
                [...favorites].sort((a, b) => b.savedAt - a.savedAt).map(fav => (
                    <div key={fav.id} className="p-4 bg-white rounded-2xl border border-slate-100 shadow-sm relative group">
                        <div className="flex justify-between items-start mb-2">
                            <span className="text-[10px] text-slate-400 font-medium">
                                {new Date(fav.timestamp).toLocaleString()}
                            </span>
                            <button 
                                onClick={() => onDelete(fav.id)}
                                className="text-slate-300 hover:text-red-400 transition-colors opacity-100 sm:opacity-0 sm:group-hover:opacity-100"
                                title="取消收藏"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                                </svg>
                            </button>
                        </div>
                        
                        <div className="mb-3">
                            {renderContent(fav)}
                        </div>

                        {fav.hasVoice && (
                            <button 
                                onClick={() => handlePlayVoice(fav)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-bold transition-all ${
                                    playingId === fav.id 
                                        ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30' 
                                        : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                                }`}
                            >
                                {playingId === fav.id ? (
                                    <>
                                        <div className="flex gap-0.5 h-3 items-end">
                                            <div className="w-0.5 bg-white h-full animate-bounce"></div>
                                            <div className="w-0.5 bg-white h-2/3 animate-bounce delay-75"></div>
                                            <div className="w-0.5 bg-white h-4/5 animate-bounce delay-150"></div>
                                        </div>
                                        播放中
                                    </>
                                ) : (
                                    <>
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3.5 h-3.5">
                                            <path d="M6.3 2.84A1.5 1.5 0 0 0 4 4.11v11.78a1.5 1.5 0 0 0 2.3 1.27l9.344-5.891a1.5 1.5 0 0 0 0-2.538L6.3 2.841Z" />
                                        </svg>
                                        播放语音
                                    </>
                                )}
                            </button>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

export default FavoritesPanel;
