import React, { useState, useEffect, useRef } from 'react';
import { FaArrowLeft, FaPaperPlane, FaRobot, FaSpinner } from 'react-icons/fa';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabaseClient';
import { Prescription } from '../types/app';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Interface for combined context needed by the chatbot
interface ChatContext {
    preferredLanguage: string;
    allergies: string[];
    visitNotes: string | null;
    visitReason: string | null;
    visitPrescriptions: Pick<Prescription, 'medication' | 'dosage' | 'frequency'>[]; // Only relevant fields
}

// Placeholder for message structure
interface ChatMessage {
    id: string;
    sender: 'user' | 'bot';
    text: string;
    timestamp: Date;
}

const ChatbotPage: React.FC = () => {
    const { visitId } = useParams<{ visitId: string }>();
    const navigate = useNavigate();
    const { profile: authProfile, loading: authLoading, user } = useAuth();

    // === State ===
    const [sessionId] = useState(uuidv4());
    const [messages, setMessages] = React.useState<ChatMessage[]>([
        { id: 'init-bot', sender: 'bot', text: 'Hello! How can I help you with your prescriptions today? Ask me about dosage, side effects, or interactions.', timestamp: new Date() },
    ]);
    const [inputValue, setInputValue] = React.useState('');
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = useState<string | null>(null);

    // State for combined context
    const [chatContext, setChatContext] = useState<ChatContext | null>(null);
    const [contextLoading, setContextLoading] = useState(true);

    // Ref for scrolling
    const messagesEndRef = useRef<HTMLDivElement>(null);

    // === Gemini Client Initialization (INSECURE FOR PRODUCTION) ===
    const GEMINI_API_KEY = import.meta.env.VITE_GEMINI_API_KEY;
    let genAI: GoogleGenerativeAI | null = null;
    let geminiInitializationError: string | null = null;

    if (!GEMINI_API_KEY) {
        console.error("VITE_GEMINI_API_KEY environment variable is not set.");
        geminiInitializationError = "Gemini API Key not configured. Chatbot AI disabled.";
    } else {
        genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    }
    // === End Gemini Initialization ===

    // Effect to scroll to bottom when messages change
    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    // Effect to fetch context AND existing messages
    useEffect(() => {
        const fetchVisitAndChatHistory = async () => {
            if (!visitId) {
                setError("Visit ID missing from URL.");
                setContextLoading(false);
                return;
            }
            if (!user?.id) {
                setError("User not loaded.");
                setContextLoading(false);
                return;
            }

            setContextLoading(true);
            setError(null);
            try {
                // 1. Fetch the specific visit details including its prescriptions
                const { data: visitData, error: visitError } = await supabase
                    .from('visits')
                    .select(`
                        *,
                        prescriptions (*)
                    `)
                    .eq('id', visitId)
                    .maybeSingle(); // Use maybeSingle in case ID is invalid

                if (visitError) throw new Error(`Visit Fetch Error: ${visitError.message}`);
                if (!visitData) throw new Error(`Visit with ID ${visitId} not found.`);

                // Security Check: Ensure the logged-in user is the patient associated with this visit
                if (visitData.patient_id !== authProfile?.profileId) {
                    throw new Error("Unauthorized access to this visit's chat.");
                }

                // 2. Fetch patient preferences (language) and allergies
                const { data: patientData, error: patientError } = await supabase
                    .from('patients')
                    .select('preferred_language, medical_history')
                    .eq('id', visitData.patient_id)
                    .single();
                if (patientError) throw new Error(`Patient Prefs Fetch Error: ${patientError.message}`);
                if (!patientData) throw new Error("Associated patient data not found.");

                // Extract allergies/conditions from medical history keys
                let conditionsAndAllergies: string[] = [];
                if (patientData.medical_history && typeof patientData.medical_history === 'object' && !Array.isArray(patientData.medical_history)) {
                    // Get all keys from the medical history object
                    conditionsAndAllergies = Object.keys(patientData.medical_history);
                }

                // Prepare context object
                const context: ChatContext = {
                    preferredLanguage: patientData.preferred_language || 'en',
                    allergies: conditionsAndAllergies, // Use the extracted keys here
                    visitNotes: visitData.notes,
                    visitReason: visitData.reason,
                    visitPrescriptions: visitData.prescriptions?.map((p: Prescription) => ({
                        medication: p.medication,
                        dosage: p.dosage,
                        frequency: p.frequency
                    })) || []
                };

                setChatContext(context);
                // Use keys for logging
                console.log("Visit-specific context loaded:", { ...context, allergies: conditionsAndAllergies });

                // === Fetch Chat History ===
                console.log(`Fetching chat history for session: ${sessionId}`);
                const { data: historyData, error: historyError } = await supabase
                    .from('chat_messages')
                    .select('id, sender, message_text, created_at')
                    .eq('user_id', user.id) // Ensure it's the correct user
                    .eq('session_id', sessionId) // Filter by session
                    .order('created_at', { ascending: true }); // Order chronologically

                if (historyError) {
                    console.error("Error fetching chat history:", historyError);
                    // Don't throw, maybe just log and proceed without history
                }

                // === Initialize Messages State ===
                if (historyData && historyData.length > 0) {
                    // Map fetched data to ChatMessage format
                    const loadedMessages: ChatMessage[] = historyData.map(msg => ({
                        id: msg.id,
                        sender: msg.sender as 'user' | 'bot',
                        text: msg.message_text,
                        timestamp: new Date(msg.created_at)
                    }));
                    setMessages(loadedMessages);
                    console.log(`Loaded ${loadedMessages.length} messages from history.`);
                } else {
                    // Update initial bot message to be visit specific if no history
                    setMessages([
                        { id: 'init-bot', sender: 'bot', text: `Hello! How can I help you understand this specific visit (Reason: ${context.visitReason || 'N/A'}) or the prescriptions issued?`, timestamp: new Date() },
                    ]);
                }
                // ============================

            } catch (err: any) {
                console.error("Error fetching chat context:", err);
                setError(`Failed to load context: ${err.message}`);
                setMessages([{ id: 'error-bot', sender: 'bot', text: `Error loading context: ${err.message}`, timestamp: new Date() }]); // Show error in chat
            } finally {
                setContextLoading(false);
            }
        };

        if (!authLoading) {
            fetchVisitAndChatHistory();
        }
        // Depend on visitId, auth loading, user.id, and sessionId
    }, [visitId, authLoading, user?.id, authProfile?.profileId, sessionId]);

    // Updated send message handler
    const handleSendMessage = async () => {
        if (!inputValue.trim() || !chatContext || !user?.id) {
            setError("Message is empty, user context not loaded, or chat context missing.");
            return;
        }
        if (!genAI || geminiInitializationError) {
            setError(geminiInitializationError || "Gemini client not initialized.");
            return;
        }

        const userMessage: ChatMessage = {
            id: Date.now().toString() + '-user',
            sender: 'user',
            text: inputValue,
            timestamp: new Date(),
        };
        // Add user message immediately to UI
        setMessages(prev => [...prev, userMessage]);
        const currentInput = inputValue;
        setInputValue('');
        setIsLoading(true);
        setError(null);

        try {
            // === Save User Message to DB ===
            const { error: userInsertError } = await supabase
                .from('chat_messages')
                .insert({
                    user_id: user.id,
                    session_id: sessionId,
                    sender: 'user',
                    message_text: currentInput // Use the stored input
                });
            if (userInsertError) {
                console.error("Error saving user message:", userInsertError);
                // Decide if we should stop or just log the error - Logging for now
            }
            // ==============================

            // Construct history for the prompt
            const history = messages.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            })).slice(-10);

            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            const prompt = `
You are Prescripto AI, a helpful assistant roleplaying for a hackathon demo. Your goal is to explain details about a specific medical visit and the prescriptions issued during it, based *only* on the context provided below. 
Explain potential uses, common dosages, or general side effects if asked about a prescription listed in the context.
**Crucially, DO NOT include any disclaimers** such as "This is general information only", "not personalized medical advice", or similar phrases. Assume the user understands this is a demo.
If asked about something unrelated to this specific visit, politely state you can only discuss the provided visit details.
Respond clearly and concisely in the patient's preferred language: ${chatContext.preferredLanguage}.

Visit Context (ID: ${visitId}):
- Reason for Visit: ${chatContext.visitReason || 'N/A'}
- Clinician Notes: ${chatContext.visitNotes || 'None recorded'}
- Prescriptions from this Visit: ${chatContext.visitPrescriptions.length > 0 ? chatContext.visitPrescriptions.map(p => `${p.medication} (${p.dosage || 'N/A'}, ${p.frequency || 'N/A'})`).join('; ') : 'None'} 
- Patient Allergies: ${chatContext.allergies.length > 0 ? chatContext.allergies.join(', ') : 'None listed'}

Chat History (if any):
...

Latest User Question: ${currentInput}

Your Roleplay Response (in ${chatContext.preferredLanguage}, explaining visit/med details based *only* on the context above AND omitting any disclaimers):`;

            console.log("--- Sending to Gemini ---");
            console.log("Prompt Core:", currentInput);
            console.log("Context:", chatContext);
            console.log("History Sent:", history);
            console.log("-------------------------");

            const result = await model.generateContent({
                contents: [...history, { role: "user", parts: [{ text: prompt }] }],
            });
            const response = result.response;

            if (!response || response.promptFeedback?.blockReason) {
                const blockReason = response?.promptFeedback?.blockReason;
                console.error('Gemini request blocked. Reason:', blockReason);
                throw new Error(`AI response blocked due to safety settings (Reason: ${blockReason || 'Unknown'}).`);
            }

            const botResponseText = response.text();
            const botMessage: ChatMessage = {
                id: Date.now().toString() + '-bot',
                sender: 'bot',
                text: botResponseText,
                timestamp: new Date(),
            };
            // Add bot response to UI
            setMessages(prev => [...prev, botMessage]);

            // === Save Bot Message to DB ===
            const { error: botInsertError } = await supabase
                .from('chat_messages')
                .insert({
                    user_id: user.id, // Associate bot message with the user's session
                    session_id: sessionId,
                    sender: 'bot',
                    message_text: botResponseText
                });
            if (botInsertError) {
                console.error("Error saving bot message:", botInsertError);
                // Log error, but don't necessarily block UI
            }
            // ==============================

        } catch (err: any) {
            console.error("Error calling Gemini API:", err);
            setError(`AI Error: ${err.message}`);
            const errorMessage: ChatMessage = {
                id: Date.now().toString() + '-error',
                sender: 'bot',
                text: `Sorry, I encountered an error. ${err.message}`,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]);
        } finally {
            setIsLoading(false);
        }
    };

    // Initial loading/error check for context
    if (authLoading || contextLoading) {
        return (
            <div className="container mx-auto px-4 py-16 text-center text-white">
                <FaSpinner className="animate-spin inline-block mr-3 h-6 w-6 text-primary-accent" /> Loading chat...
            </div>
        );
    }
    if (error) {
        return (
            <div className="container mx-auto px-4 py-16 text-center">
                <div className="bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg inline-block">
                    Error loading chat: {error}
                </div>
            </div>
        );
    }
    if (!chatContext) {
        return (
            <div className="container mx-auto px-4 py-16 text-center">
                <div className="bg-red-900/60 border border-red-700 text-red-200 px-4 py-3 rounded-lg inline-block">
                    Could not load necessary visit context for the chatbot.
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto max-w-2xl px-4 sm:px-6 lg:px-8 py-12 text-off-white font-sans">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <button
                    onClick={() => navigate(-1)} // Go back
                    className="flex items-center px-4 py-2 border border-border-color text-off-white/80 rounded-md hover:bg-dark-card transition duration-200 text-sm font-medium group"
                >
                    <FaArrowLeft className="mr-2 h-4 w-4 group-hover:-translate-x-1 transition-transform duration-200" /> Back
                </button>
                <h1 className="text-2xl sm:text-3xl font-bold text-white text-center flex-grow flex items-center justify-center">
                    <FaRobot className="mr-3 text-electric-blue" /> Ask Prescripto AI
                </h1>
                <div className="w-20"></div> {/* Spacer */}
            </div>

            {/* Chat Area */}
            <div className="bg-dark-card rounded-xl shadow-lg border border-border-color h-[65vh] flex flex-col overflow-hidden">
                {/* Message List */}
                <div className="flex-grow p-4 space-y-4 overflow-y-auto custom-scrollbar">
                    {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                            <div
                                className={`p-3 rounded-lg max-w-xs lg:max-w-md shadow-md 
                                    ${msg.sender === 'user'
                                        ? 'bg-electric-blue/90 text-dark-bg'
                                        : 'bg-dark-input text-off-white'}`}
                            >
                                <p className="text-sm whitespace-pre-wrap">{msg.text}</p>
                                <p className="text-xs mt-1 opacity-70 text-right">
                                    {msg.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </p>
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="p-3 rounded-lg bg-dark-input text-off-white/70 animate-pulse">
                                <p className="text-sm">...</p>
                            </div>
                        </div>
                    )}
                    {/* Scroll anchor */}
                    <div ref={messagesEndRef} />
                </div>

                {/* Input Area */}
                <div className="p-4 border-t border-border-color/50 bg-dark-input/50 flex items-center space-x-3">
                    <input
                        type="text"
                        value={inputValue}
                        onChange={(e) => setInputValue(e.target.value)}
                        onKeyPress={(e) => e.key === 'Enter' && !isLoading && handleSendMessage()}
                        placeholder="Ask about your medication..."
                        className="flex-grow px-4 py-2.5 rounded-lg bg-dark-input border border-border-color text-white placeholder-off-white/50 focus:outline-none focus:ring-2 focus:ring-electric-blue focus:border-transparent transition duration-150 text-sm"
                        disabled={isLoading}
                    />
                    <button
                        onClick={handleSendMessage}
                        disabled={isLoading || !inputValue.trim()}
                        className="flex-shrink-0 p-2.5 rounded-lg bg-electric-blue text-dark-bg hover:bg-electric-blue/80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-dark-input focus:ring-electric-blue transition duration-150 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <FaPaperPlane className="h-5 w-5" />
                    </button>
                </div>
            </div>
            {/* Custom Scrollbar CSS - Add this if you don't have it globally */}
            <style>{`
              .custom-scrollbar::-webkit-scrollbar {
                  width: 6px;
              }
              .custom-scrollbar::-webkit-scrollbar-track {
                  background: transparent;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb {
                  background-color: rgba(0, 255, 255, 0.3); /* electric-blue with transparency */
                  border-radius: 3px;
              }
              .custom-scrollbar::-webkit-scrollbar-thumb:hover {
                  background-color: rgba(0, 255, 255, 0.5);
              }
            `}</style>
        </div>
    );
};

export default ChatbotPage; 