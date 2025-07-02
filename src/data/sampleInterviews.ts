import { Interview, TranscriptMessage } from '../types/interview';

const createTranscriptMessage = (
  speaker: 'interviewer' | 'candidate',
  message: string,
  timestamp: Date
): TranscriptMessage => ({
  id: Math.random().toString(36).substr(2, 9),
  speaker,
  message,
  timestamp,
});

export const sampleInterviews: Interview[] = [
  {
    id: '1',
    role: 'Marketing Manager',
    skills: [ 'Marketing Strategy', 'Business Development', 'Data Analysis', 'Market Research', 'Communication'],
    date: new Date('2024-12-11T10:00:00'),
    status: 'completed',
    duration: 569000,
    transcript: [
      createTranscriptMessage(
        'interviewer',
        `Hello! I'm Shambhavi. I'll be evaluating your fit for the Marketing Manager role at Unstop. Could you start by telling me your name, your current position, and a bit about your educational background?`,
        new Date('2024-12-11T00:00:04')
      ),
      createTranscriptMessage(
        'candidate',
        `Hi Shambhavi, I am Harshvardhan Bajoria and I have done BTEC CSE from Amity University Kolkata. I've done a few certifications and I've done marketing for GitHub and Microsoft where I've shared about their latest innovations to the developers out there and I've also helped them create using those particular innovations that's being planned in the future.`,
        new Date('2024-12-11T00:00:40')
      ),
      createTranscriptMessage(
        'interviewer',
        `Nice to meet you, Harshvardhan. It sounds like you have some impressive experience. Let's dive into a few questions to understand your approach to marketing. First, what do you think is the most critical first step when creating a marketing strategy for a new product? Is it A) Defining the target audience, B) Designing promotional materials, C) Analyzing competitor pricing, or D) Launching a social media campaign? Please explain your choice.`,
        new Date('2024-12-11T00:00:46')
      ),
      createTranscriptMessage(
        'candidate',
        `Um, I think it's A.`,
        new Date('2024-12-11T00:01:20')
      ),
      createTranscriptMessage(
        'interviewer',
        `Great. Can you explain why you chose A) Defining the target audience?`,
        new Date('2024-12-11T00:01:22')
      ),
      createTranscriptMessage(
        'candidate',
        `According to me, I think if I define my target audience, I can create the budget and the promotional content based upon it.`,
        new Date('2024-12-11T00:01:36')
      ),
      createTranscriptMessage(
        'interviewer',
        `That's a solid approach. Now, let's move to the next scenario. If you notice a drop in conversion rates from an online campaign, what would be your first course of action? Would you A) Increase the advertising budget, B) Analyze the campaign’s performance metrics, C) Switch to a different marketing channel, or D) Conduct a survey to gather customer feedback? Please explain your choice.`,
        new Date('2024-12-11T00:01:42')
      ),
      createTranscriptMessage(
        'candidate',
        `I think it's C.`,
        new Date('2024-12-11T00:02:13')
      ),
      createTranscriptMessage(
        'interviewer',
        `Interesting choice. Can you share why you would switch to a different marketing channel in this scenario?`,
        new Date('2024-12-11T00:02:15')
      ),
      createTranscriptMessage(
        'candidate',
        `I would switch to a different marketing channel so that I can better understand what are the different issues, what are different things that is being faced and based upon that I can take certain actions. This will help me understand that okay different marketing channels are working well so it's not the problem with the content but it's the problem with the channel itself.`,
        new Date('2024-12-11T00:02:46')
      ),
      createTranscriptMessage(
        'interviewer',
        `I see, that makes sense. Let's move on to a more in-depth scenario. As a marketing manager, if you're tasked with optimizing a digital ad campaign that's underperforming, what steps would you take to diagnose the issues? Please start by explaining your initial steps.`,
        new Date('2024-12-11T00:02:50')
      ),
      createTranscriptMessage(
        'candidate',
        `So first of all, I would try to understand where the users are dropping in the journey, understand maybe through click-through rates and through conversion rates that what is the issue that they might be facing. Then based upon surveys, get more data and then maybe reinvent with our approach and come up with a new design, a new prompt so that it can help us better.`,
        new Date('2024-12-11T00:03:31')
      ),
      createTranscriptMessage(
        'interviewer',
        `Excellent, that's a comprehensive approach. Now, let's shift gears a bit. We'll do a role-play scenario. Imagine I'm a client named Harshavardhan, frustrated with previous marketing strategies that failed. How would you address my concerns and try to build rapport? Let's start with me expressing my disappointment. "I'm really unhappy with the results of our last campaign. It feels like we wasted a lot of time and money."`,
        new Date('2024-12-11T00:03:37')
      ),
      createTranscriptMessage(
        'candidate',
        `मुझे इस मुद्दे के लिए खेद है, क्या आप कृपया बता सकते हैं कि मामला क्या था?`,
        new Date('2024-12-11T00:04:15')
      ),
      createTranscriptMessage(
        'interviewer',
        `मुझे लगता है कि हमारी पिछली मार्केटिंग रणनीति ने हमारे लक्ष्यों को पूरा नहीं किया। हमने जो निवेश किया, उसका कोई ठोस परिणाम नहीं दिखा।`,
        new Date('2024-12-11T00:04:18')
      ),
      createTranscriptMessage(
        'candidate',
        `ठीक है हम कोशिश कर रहे हैं कि इस बार ऐसा ना हो हमने बहुत सारी नई changes किये हैं बहुत सारे improvements किये हैं नई team लाई हैं और इस बार आपको 24 x 7 support भी मिलेगा`,
        new Date('2024-12-11T00:04:44')
      ),
      createTranscriptMessage(
        'interviewer',
        `यह सुनकर अच्छा लगा। लेकिन मुझे अभी भी संदेह है। आप कैसे सुनिश्चित करेंगे कि इस बार हमारी अभियान सफल होगा?`,
        new Date('2024-12-11T00:04:45')
      ),
      createTranscriptMessage(
        'candidate',
        `इस बार मैं सुनिश्य करूँगा क्योंकि हमने बहुत सारे डेटा लिया है, बहुत सारे नई चीजे लाई हैं तो इस बार मैं आपको वादा दे सकाँ कि इस बार ऐसा कुछ नहीं होगा हमने और चीजे निकाल लिये हैं, और डेप्थ में गए हैं जिस से हम और अच्छे स्याग के लिए मार्केटिंग कर रहे हैं`,
        new Date('2024-12-11T00:05:17')
      ),
      createTranscriptMessage(
        'interviewer',
        `यह सुनकर आश्वासन मिला। क्या आप कुछ उदाहरण दे सकते हैं, कि आपने कौन सी नई रणनीतियां अपनाई हैं?`,
        new Date('2024-12-11T00:05:17')
      ),
      createTranscriptMessage(
        'candidate',
        `तो मैंने सबसे पहले समझा है कि कहाँ पे इशू है, क्या इशू है उसके बाद मैंने और भी चीज़े की ये हैं जैसे की आपका समझा हूँ कि कहाँ पे हम लोग और better कर सकते हैं क्या target audience हमारी और अच्छी हो सकती है हम लोग और क्या कर सकते हैं आगे कैसे content को और better कर सकते हैं`,
        new Date('2024-12-11T00:05:54')
      ),
      createTranscriptMessage(
        'interviewer',
        `यह सब बहुत अच्छा लगता है। मुझे आशा है कि इस बार हम बेहतर परिणाम देखेंगे। चलिए, हम एक और सवाल की ओर बढ़ते हैं। हमें बताइए, जब आप किसी मुश्किल परियोजना का सामना करते हैं, तो आप उसे कैसे प्रबंधित करते हैं?`,
        new Date('2024-12-11T00:05:55')
      ),
      createTranscriptMessage(
        'candidate',
        `तो मैं सबसे पहले समझता हूँ कि कहाँ पे इश्यू है और फिर उसके बाद उसको सॉल्फ करता हूँ और ज़्यादा अच्छे solution निकाल के और optimize solution निकाल के`,
        new Date('2024-12-11T00:06:27')
      ),
      createTranscriptMessage(
        'interviewer',
        `यह एक प्रभावी तरीका है। अब, आखिरी सवाल, आप Unstop की कंपनी संस्कृति और मूल्यों के साथ कैसे तालमेल बिठाएंगे?`,
        new Date('2024-12-11T00:06:29')
      ),
      createTranscriptMessage(
        'candidate',
        `正常するのに最適な場所だと思いますし、エクセルはその膨大な役割で、私は在職中に様々な役割に挑戦し、自分自身を急速に正常されるでしょう。`,
        new Date('2024-12-11T00:07:34')
      ),
      createTranscriptMessage(
        'interviewer',
        `それは素晴らしい姿勢です。Unstopでの成長に対する意欲を示してくれてありがとう。それでは、この役割や会社について何か質問はありますか？`,
        new Date('2024-12-11T00:07:37')
      ),
      createTranscriptMessage(
        'candidate',
        `質問はありません`,
        new Date('00:08:34')
      ),
      createTranscriptMessage(
        'interviewer',
        `こちらこそ、ありがとうございます。それでは、今後の採用プロセスについてお伝えします。次のステップに進む場合は、追ってご連絡いたします。よろしくお願いします。`,
        new Date('2024-12-11T00:08:38')
      ),
      createTranscriptMessage(
        'candidate',
        `ありがとう！`,
        new Date('2024-12-11T00:09:10')
      ),
    ],
    feedback: `<p>Certainly, based on the interaction we've had, here is the detailed evaluation report for Harshvardhan Bajoria:</p>
<p><strong>Candidate Skills Evaluation Report</strong></p>
<p><strong>Candidate Name:</strong> Harshvardhan Bajoria<br>
<strong>Position:</strong> Marketing Manager at Unstop</p> <br>
<h2><strong>Skills Assessment</strong></h2><br>
<h3><strong>Marketing Strategy</strong></h3>
<ul>
<li><strong>Rating:</strong> 7/10</li>
<li><strong>Comments:</strong> Harshvardhan demonstrated a good understanding of the importance of defining the target audience as a critical first step in creating a marketing strategy. He emphasized tailoring the budget and promotional content accordingly. His experience with major tech companies indicates a solid foundation in this area.</li>
</ul>
<br>
<h3><strong>Business Development</strong></h3>
<ul>
<li><strong>Rating:</strong> 6/10</li>
<li><strong>Comments:</strong> While Harshvardhan has experience in marketing for tech giants, his responses did not deeply cover aspects of business development. However, his willingness to adapt and improve strategies is a positive trait.</li>
</ul>
<br>
<h3><strong>Data Analysis</strong></h3>
<ul>
<li><strong>Rating:</strong> 7/10</li>
<li><strong>Comments:</strong> He showed an understanding of analyzing campaign performance through metrics like click-through rates and conversion rates. However, his choice to switch marketing channels as an initial step might not always be the most effective approach. A more nuanced analysis might be required.</li>
</ul><br>
<h3><strong>Communication</strong></h3>
<ul>
<li><strong>Rating:</strong> 8/10</li>
<li><strong>Comments:</strong> Harshvardhan effectively communicated his thoughts and strategies throughout the discussion. He was able to address concerns and provide reassurance in the role-play scenario, indicating strong interpersonal skills.</li>
</ul>
<br>
<h3><strong>Market Research</strong></h3>
<ul>
<li><strong>Rating:</strong> 7/10</li>
<li><strong>Comments:</strong> His approach to understanding issues and gathering data through surveys shows a good grasp of market research fundamentals. He seems capable of leveraging research to inform marketing strategies.</li>
</ul>
<br>
<h2><strong>Overall Feedback</strong></h2>
<p>Harshvardhan Bajoria  shows potential for the Marketing Manager role, especially with his experience in tech marketing. His strengths lie in his strategic thinking and communication skills. While he may need to delve deeper into business development and data analysis, his adaptability and eagerness to learn are promising. With additional support and resources, he could be a valuable asset to the team.</p>`,
idealRating: [7, 8, 7, 8, 7],
candidateRating: [7, 6, 7, 8, 7]},
  {
    id: '2',
    role: 'Marketing Manager',
    skills: ['Digital Marketing', 'SEO', 'Content Strategy'],
    date: new Date('2024-12-12T14:00:00'),
    duration: 83631,
    status: 'completed',
    transcript: [
      createTranscriptMessage(
        'interviewer',
        'What experience do you have with digital marketing campaigns?',
        new Date('2024-12-12T00:00:10')
      ),
      createTranscriptMessage(
        'candidate',
        'I have led several successful digital marketing campaigns, focusing on multi-channel strategies including social media, email marketing, and PPC advertising...',
        new Date('2024-12-12T00:00:30')
      ),
      createTranscriptMessage(
        'interviewer',
        'How do you measure the success of a marketing campaign?',
        new Date('2024-12-12T00:01:02')
      ),
      createTranscriptMessage(
        'candidate',
        'I focus on key metrics such as ROI, conversion rates, customer acquisition cost, and engagement metrics...',
        new Date('2024-12-12T00:01:22')
      ),
    ],
    feedback: `Certainly, but it seems we haven't had enough interaction yet to provide a detailed evaluation report. To give a comprehensive assessment, I would need more information about the candidate's skills and experiences in program management, sales, and marketing. If you have more questions or scenarios we can discuss, I'd be happy to continue and provide a thorough evaluation once we have enough information.`,
    idealRating: [],
    candidateRating: [],
  },
];