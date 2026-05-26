import React, { useState, useEffect } from 'react';
import { CharacterProfile, HisDailyEvent, Worldbook } from '../types';
import { useOS } from '../context/OSContext';
import { DB } from '../utils/db';
import { generateHisDailyEvents } from '../utils/hisDailyGenerator';
import { CalendarBlank, CaretLeft, CaretDown } from '@phosphor-icons/react';

export const HisDailyApp: React.FC = () => {
    const { characters, apiConfig, addToast, closeApp } = useOS();
    const [view, setView] = useState<'selection' | 'detail'>('selection');
    const [selectedCharId, setSelectedCharId] = useState<string | null>(null);
    
    const activeChar = characters.find(c => c.id === selectedCharId);
    
    const [events, setEvents] = useState<HisDailyEvent[]>([]);
    const [worldbooks, setWorldbooks] = useState<Worldbook[]>([]);
    const [selectedWbIds, setSelectedWbIds] = useState<string[]>([]);
    const [selectedDate, setSelectedDate] = useState<string>(
        new Date().toISOString().split('T')[0]
    );
    const [isGenerating, setIsGenerating] = useState(false);
    const [imgStatus, setImgStatus] = useState<Record<string, 'loading' | 'loaded' | 'error'>>({});
    const [isWbExpanded, setIsWbExpanded] = useState(false);

    useEffect(() => {
        if (!activeChar || view !== 'detail') return;
        loadData();
    }, [activeChar, selectedDate, view]);

    const loadData = async () => {
        if (!activeChar) return;
        try {
            const allWb = await DB.getAllWorldbooks();
            setWorldbooks(allWb);

            const dailyEvents = await DB.getHisDailyEvents(activeChar.id, selectedDate);
            setEvents(dailyEvents);
        } catch (e) {
            console.error('Failed to load HisDaily data:', e);
        }
    };

    const handleGenerate = async () => {
        if (!activeChar || !apiConfig) {
            addToast('缺少角色或 API 配置', 'error');
            return;
        }
        setIsGenerating(true);
        try {
            const selectedWorldbooks = worldbooks.filter(wb => selectedWbIds.includes(wb.id));
            const schedule = await DB.getDailySchedule(activeChar.id, selectedDate);
            
            const newEvents = await generateHisDailyEvents(
                activeChar,
                apiConfig,
                selectedWorldbooks,
                schedule,
                selectedDate
            );

            for (const event of newEvents) {
                await DB.saveHisDailyEvent(event);
            }
            
            addToast('生成成功！', 'success');
            await loadData();
        } catch (e: any) {
            addToast(e.message || '生成失败', 'error');
        } finally {
            setIsGenerating(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm('确定要删除这条事件吗？')) {
            await DB.deleteHisDailyEvent(id);
            await loadData();
        }
    };

    const handleShare = async (event: HisDailyEvent) => {
        if (!activeChar) return;
        
        if (window.confirm('确定要让角色在接下来的聊天中提起这件事吗？')) {
            // 标记为已提及
            await DB.markHisDailyEventMentioned(event.id);
            
            // 存一条系统提示到聊天记录
            await DB.saveMessage({
                charId: activeChar.id,
                role: 'system',
                type: 'text',
                content: `[系统指令: 请在接下来的回复中，自然地向用户提起你今天经历的这件事（注意时间是 ${event.time}）："${event.content}"]`
            });
            
            addToast('已设置为角色的下一个话题！去聊天吧~', 'success');
            await loadData();
        }
    };

    const toggleWbSelection = (id: string) => {
        setSelectedWbIds(prev => 
            prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
        );
    };

    const getCharGradient = (name: string): string => {
        const gradients = [
            'linear-gradient(to bottom right, #fb7185, #ec4899)',
            'linear-gradient(to bottom right, #a78bfa, #8b5cf6)',
            'linear-gradient(to bottom right, #60a5fa, #6366f1)',
            'linear-gradient(to bottom right, #22d3ee, #14b8a6)',
            'linear-gradient(to bottom right, #34d399, #22c55e)',
            'linear-gradient(to bottom right, #fbbf24, #f97316)',
            'linear-gradient(to bottom right, #f87171, #f43f5e)',
            'linear-gradient(to bottom right, #e879f9, #ec4899)',
        ];
        let hash = 0;
        for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
        return gradients[Math.abs(hash) % gradients.length];
    };

    const handleBack = () => {
        if (view === 'detail') {
            setView('selection');
            setSelectedCharId(null);
        } else {
            closeApp();
        }
    };

    const handleCharClick = (id: string) => {
        setSelectedCharId(id);
        setView('detail');
    };

    const renderSelection = () => (
        <div className="grid grid-cols-2 gap-5 p-5 animate-fade-in">
            {characters.map(char => {
                const status = imgStatus[char.id] || 'loading';
                return (
                    <button
                        key={char.id}
                        onClick={() => handleCharClick(char.id)}
                        className="flex flex-col gap-2.5 group active:scale-95 transition-all"
                    >
                        <div className="w-full relative rounded-3xl shadow-md overflow-hidden border border-white/60" style={{ paddingBottom: '100%', backgroundImage: getCharGradient(char.name), backgroundColor: '#94a3b8' }}>
                            <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
                                <span className="text-white/60 text-5xl font-bold select-none drop-shadow-md">{char.name.charAt(0)}</span>
                            </div>
                            {status !== 'error' && (
                                <img
                                    src={char.avatar}
                                    alt={char.name}
                                    className={`absolute inset-0 w-full h-full object-cover z-10 transition-opacity duration-300 group-hover:scale-105 ${status === 'loaded' ? 'opacity-90 group-hover:opacity-100' : 'opacity-0'}`}
                                    loading="lazy"
                                    decoding="async"
                                    onLoad={() => setImgStatus(prev => ({ ...prev, [char.id]: 'loaded' }))}
                                    onError={() => setImgStatus(prev => ({ ...prev, [char.id]: 'error' }))}
                                />
                            )}
                            <div className="absolute inset-0 z-20 bg-gradient-to-t from-black/60 via-black/10 to-transparent"></div>
                            <div className="absolute bottom-0 left-0 right-0 z-30 px-3 pb-2.5 pt-6 bg-gradient-to-t from-black/50 to-transparent flex items-end justify-between">
                                <span className="text-white text-sm font-bold drop-shadow-[0_1px_3px_rgba(0,0,0,0.8)]">{char.name}</span>
                            </div>
                        </div>
                    </button>
                );
            })}
            {characters.length === 0 && <div className="col-span-2 text-center text-slate-400 py-16 text-xs">暂无角色</div>}
        </div>
    );

    const renderDetail = () => {
        if (!activeChar) return null;
        return (
            <div className="flex flex-col flex-1 overflow-hidden animate-fade-in">
                {/* 顶部日期选择 */}
                <div className="p-4 border-b border-slate-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 flex items-center justify-between shadow-sm shrink-0">
                    <div className="flex items-center space-x-2">
                        <CalendarBlank className="w-5 h-5 text-indigo-500" />
                        <input 
                            type="date" 
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                            className="bg-transparent text-lg font-medium outline-none cursor-pointer text-slate-800 dark:text-slate-200"
                        />
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4 space-y-6">
                    {/* 世界书选择 */}
                    <div className="bg-white dark:bg-zinc-900 border border-slate-200 dark:border-zinc-700 rounded-xl overflow-hidden shadow-sm shrink-0">
                        <button 
                            onClick={() => setIsWbExpanded(!isWbExpanded)}
                            className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 dark:bg-zinc-800/50 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                            <div className="flex flex-col items-start">
                                <span className="text-sm font-bold text-slate-700 dark:text-slate-200">附加世界书设定</span>
                                <span className="text-[10px] text-slate-500 dark:text-slate-400 mt-0.5">
                                    {selectedWbIds.length > 0 ? `已选择 ${selectedWbIds.length} 本世界书` : '未选择，点击展开'}
                                </span>
                            </div>
                            <CaretDown className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${isWbExpanded ? 'rotate-180' : ''}`} />
                        </button>
                        
                        {isWbExpanded && (
                            <div className="p-3 border-t border-slate-100 dark:border-zinc-700/50 bg-slate-50/50 dark:bg-zinc-900/50">
                                {worldbooks.length === 0 ? (
                                    <p className="text-sm text-slate-400 text-center py-2">暂无世界书</p>
                                ) : (
                                    <div className="flex flex-col gap-2 max-h-[30vh] overflow-y-auto pr-1">
                                        {worldbooks.map(wb => (
                                            <button
                                                key={wb.id}
                                                onClick={() => toggleWbSelection(wb.id)}
                                                className={`w-full px-4 py-2.5 rounded-xl text-sm font-medium transition-colors flex justify-between items-center shrink-0 ${
                                                    selectedWbIds.includes(wb.id)
                                                        ? 'bg-indigo-500 text-white shadow-sm'
                                                        : 'bg-white dark:bg-zinc-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-zinc-700 hover:bg-slate-100 dark:hover:bg-zinc-700'
                                                }`}
                                            >
                                                <span className="truncate">{wb.title}</span>
                                                <div className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${selectedWbIds.includes(wb.id) ? 'border-white bg-white/20' : 'border-slate-300 dark:border-zinc-600'}`}>
                                                    {selectedWbIds.includes(wb.id) && (
                                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 text-white" viewBox="0 0 20 20" fill="currentColor">
                                                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}
                    </div>

                    {/* 操作区 */}
                    <button
                        onClick={handleGenerate}
                        disabled={isGenerating}
                        className={`w-full py-3 rounded-xl font-bold text-white transition-all transform active:scale-[0.98] ${
                            isGenerating ? 'bg-indigo-300 cursor-not-allowed' : 'bg-indigo-500 hover:bg-indigo-600 shadow-md hover:shadow-lg'
                        }`}
                    >
                        {isGenerating ? '正在生成脑洞中...' : '生成今日随机事件'}
                    </button>

                    {/* 事件列表 */}
                    <div className="space-y-4 pt-2">
                        <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider">
                            {selectedDate === new Date().toISOString().split('T')[0] ? '今天发生的事' : '那天的记录'}
                        </h3>
                        {events.length === 0 ? (
                            <div className="text-center py-10 bg-white dark:bg-zinc-800 rounded-2xl border border-dashed border-slate-200 dark:border-zinc-700">
                                <p className="text-slate-400 text-sm">这一天平平淡淡，没发生什么特别的事。</p>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {events.map(event => (
                                    <div key={event.id} className="bg-white dark:bg-zinc-800 p-4 rounded-2xl shadow-sm border border-slate-100 dark:border-zinc-700/50 relative group text-slate-800 dark:text-slate-200">
                                        <div className="flex justify-between items-start mb-2">
                                            <span className="inline-block px-2 py-1 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 text-xs font-bold rounded-md">
                                                {event.time}
                                            </span>
                                            <div className="flex items-center space-x-2">
                                                {event.isMentioned ? (
                                                    <span className="text-[10px] text-green-500 font-medium px-2 py-0.5 bg-green-50 dark:bg-green-500/10 rounded-full">已在聊天中提起</span>
                                                ) : (
                                                    <span className="text-[10px] text-slate-400 font-medium px-2 py-0.5 bg-slate-100 dark:bg-zinc-700 rounded-full">等待时机提起</span>
                                                )}
                                                {!event.isMentioned && (
                                                    <button onClick={() => handleShare(event)} className="text-indigo-400 opacity-0 group-hover:opacity-100 transition-opacity" title="让角色提起这件事">
                                                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg>
                                                    </button>
                                                )}
                                                <button onClick={() => handleDelete(event.id)} className="text-red-400 opacity-0 group-hover:opacity-100 transition-opacity" title="删除">
                                                    <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"></path><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"></path><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"></path></svg>
                                                </button>
                                            </div>
                                        </div>
                                        <p className="text-sm leading-relaxed whitespace-pre-wrap">{event.content}</p>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            </div>
        );
    };

    return (
        <div className="h-full w-full flex flex-col font-sans bg-slate-50 dark:bg-zinc-900 text-slate-800 dark:text-slate-200 overflow-hidden relative">
            {/* 顶部栏 */}
            <div className="pt-3 pb-3 px-4 shrink-0 bg-white dark:bg-zinc-950 border-b border-slate-200 dark:border-zinc-800 flex items-center">
                <button
                    onClick={handleBack}
                    className="w-10 h-10 -ml-2 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-zinc-800 transition-colors"
                >
                    <CaretLeft size={24} weight="bold" />
                </button>
                <div className="ml-2 font-bold text-lg">
                    {view === 'selection' ? '他的日常' : activeChar?.name || '他的日常'}
                </div>
            </div>

            {view === 'selection' ? (
                <div className="flex-1 overflow-y-auto min-h-0">
                    {renderSelection()}
                </div>
            ) : (
                renderDetail()
            )}
        </div>
    );
};
