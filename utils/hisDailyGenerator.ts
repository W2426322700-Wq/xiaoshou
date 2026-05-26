import { APIConfig, CharacterProfile, Worldbook, HisDailyEvent, DailySchedule } from '../types';

interface GenerationResult {
    events: {
        time: string;
        content: string;
    }[];
}

export async function generateHisDailyEvents(
    char: CharacterProfile,
    apiConfig: APIConfig,
    worldbooks: Worldbook[],
    schedule: DailySchedule | null,
    targetDate: string
): Promise<HisDailyEvent[]> {
    const baseUrl = apiConfig.baseUrl.replace(/\/+$/, '');
    
    // 提取世界书内容
    const worldbookContext = worldbooks.length > 0 
        ? `\n\n### 世界设定参考 (Worldbooks)\n${worldbooks.map(wb => `【${wb.title}】\n${wb.content}`).join('\n\n')}`
        : '';
        
    // 提取日程内容
    const scheduleContext = schedule && schedule.slots.length > 0
        ? `\n\n### 今日日程参考 (Schedule)\n${schedule.slots.map(s => `- ${s.startTime}: ${s.activity} (${s.description || ''})`).join('\n')}`
        : '';

    const systemPrompt = `你是一个负责扩写角色【${char.name}】单日生活碎片的创意引擎。
你需要根据角色的性格、提供的世界设定和当天的日常安排，脑洞大开地生成 2 到 3 件他在今天（${targetDate}）碰到的具体小事件。

事件要求：
1. 必须是具体的、生动的、充满细节的“碎片事件”。
2. 可以是日常搞笑、突发状况、小烦恼、小确幸，或者和世界设定紧密结合的奇遇。
3. 这些事件应该丰富角色的生活，让他在后续和玩家聊天时能有话可说。
4. 每件事都需要注明发生的大致时间段（如 "早上 8:30"、"午休时间"、"黄昏时分"、"晚上 11 点" 等）。
5. 必须严格返回如下格式的纯 JSON 数据（不要输出 markdown code block 标记，直接输出 JSON）：

{
  "events": [
    {
      "time": "时间描述",
      "content": "具体的事件描述"
    }
  ]
}

### 角色基础设定
名字：${char.name}
性格描述：${char.description}
人设详情：${char.systemPrompt}${worldbookContext}${scheduleContext}
`;

    try {
        const response = await fetch(`${baseUrl}/chat/completions`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiConfig.apiKey}`
            },
            body: JSON.stringify({
                model: apiConfig.model,
                messages: [
                    { role: 'system', content: systemPrompt },
                    { role: 'user', content: `请为【${char.name}】生成今天的 2-3 个日常事件，格式必须是纯 JSON。` }
                ],
                temperature: 0.9, // 稍微高一点以增加创意
                response_format: { type: 'json_object' }
            })
        });

        if (!response.ok) {
            throw new Error(`API 请求失败: ${response.status} ${response.statusText}`);
        }

        const data = await response.json();
        let resultJson: GenerationResult;
        
        try {
            const rawContent = data.choices[0].message.content;
            resultJson = JSON.parse(rawContent) as GenerationResult;
        } catch (e) {
            console.error("JSON 解析失败，返回原始内容", data.choices[0].message.content);
            throw new Error("模型返回的数据格式不正确");
        }
        
        if (!resultJson.events || !Array.isArray(resultJson.events)) {
             throw new Error("模型返回的 JSON 缺少 events 数组");
        }

        // 构造实体并返回
        const timestamp = Date.now();
        const generatedEvents: HisDailyEvent[] = resultJson.events.map((e, index) => ({
            id: `hd_${timestamp}_${index}`,
            charId: char.id,
            date: targetDate,
            time: e.time,
            content: e.content,
            worldbookIds: worldbooks.map(wb => wb.id),
            isMentioned: false,
            createdAt: timestamp
        }));

        return generatedEvents;

    } catch (e) {
        console.error("生成角色的日常事件时出错:", e);
        throw e;
    }
}
