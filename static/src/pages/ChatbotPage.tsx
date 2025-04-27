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
    const [messages, setMessages] = React.useState<ChatMessage[]>([]);
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
                // 1. Fetch the specific visit details including its prescriptions AND chat_history
                const { data: visitData, error: visitError } = await supabase
                    .from('visits')
                    .select(`
                        *,
                        prescriptions (*),
                        chat_history 
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

                // === Initialize Messages State from visitData.chat_history ===
                let initialMessages: ChatMessage[] = [];
                // Check if chat_history and chat_history.messages exist and is an array
                if (visitData.chat_history && Array.isArray((visitData.chat_history as any).messages)) {
                    try {
                        // Attempt to parse the messages, ensuring timestamps are Dates
                        initialMessages = ((visitData.chat_history as any).messages as any[]).map(msg => ({
                            ...msg,
                            timestamp: new Date(msg.timestamp) // Convert string timestamp back to Date object
                        }));
                        console.log(`Loaded ${initialMessages.length} messages from visit chat_history.`);
                    } catch (parseError) {
                        console.error("Error parsing chat history from DB:", parseError);
                        setError("Failed to parse chat history.");
                        // Fallback to initial message if parsing fails
                        initialMessages = [
                            { id: 'init-bot-parse-error', sender: 'bot', text: `Error loading chat history. How can I help with the visit (Reason: ${context.visitReason || 'N/A'})?`, timestamp: new Date() }
                        ];
                    }
                }

                // If no messages were loaded (either null history or empty array), set the initial bot message
                if (initialMessages.length === 0) {
                    initialMessages = [
                        { id: 'init-bot', sender: 'bot', text: `Hello! How can I help you understand this specific visit (Reason: ${context.visitReason || 'N/A'}) or the prescriptions issued?`, timestamp: new Date() }
                    ];
                    console.log("No chat history found or history was empty, setting initial bot message.");
                }
                setMessages(initialMessages);
                // =======================================================

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
        // Depend on visitId, auth loading, and user.id
    }, [visitId, authLoading, user?.id]);

    // Updated send message handler
    const handleSendMessage = async () => {
        if (!inputValue.trim() || !chatContext || !user?.id || !visitId) {
            setError("Message is empty, user context not loaded, chat context missing, or visit ID invalid.");
            return;
        }
        if (!genAI || geminiInitializationError) {
            setError(geminiInitializationError || "Gemini client not initialized.");
            return;
        }

        const userMessage: ChatMessage = {
            id: uuidv4() + '-user', // Use uuid for unique IDs
            sender: 'user',
            text: inputValue,
            timestamp: new Date(),
        };
        // Store current input and clear
        const currentInput = inputValue;
        setInputValue('');

        // Optimistically update UI state
        const updatedMessages = [...messages, userMessage];
        setMessages(updatedMessages);
        setIsLoading(true);
        setError(null);

        // --- Function to update DB --- 
        const updateChatHistoryInDB = async (newMessages: ChatMessage[]) => {
            try {
                const { error: updateError } = await supabase
                    .from('visits')
                    .update({ chat_history: { messages: newMessages } })
                    .eq('id', visitId);
                if (updateError) {
                    console.error("Error updating chat history in DB:", updateError);
                    // Optionally revert optimistic update or show error to user
                    setError("Failed to save message history.");
                }
            } catch (dbError) {
                console.error("Exception updating chat history:", dbError);
                setError("Failed to save message history due to an exception.");
            }
        };
        // --- End DB Update Function --- 

        try {
            // Save user message batch (immediately)
            await updateChatHistoryInDB(updatedMessages);

            // Construct history for the prompt (use the state `updatedMessages` which includes the user message)
            const historyForPrompt = updatedMessages.map(msg => ({
                role: msg.sender === 'user' ? 'user' : 'model',
                parts: [{ text: msg.text }]
            })).slice(-10); // Get last 10 interactions

            const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
            // *** Construct the prompt using currentInput ***
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
            console.log("History Sent (for prompt construction):", historyForPrompt);
            console.log("-------------------------");

            const result = await model.generateContent({ // Use generateContent, not generateContentStream
                contents: [...historyForPrompt, { role: "user", parts: [{ text: prompt }] }],
            });
            const response = result.response;

            if (!response || response.promptFeedback?.blockReason) {
                const blockReason = response?.promptFeedback?.blockReason;
                console.error('Gemini request blocked. Reason:', blockReason);
                throw new Error(`AI response blocked due to safety settings (Reason: ${blockReason || 'Unknown'}).`);
            }

            const botResponseText = response.text();
            const botMessage: ChatMessage = {
                id: uuidv4() + '-bot', // Use uuid
                sender: 'bot',
                text: botResponseText,
                timestamp: new Date(),
            };

            // Update UI state with bot message
            const finalMessages = [...updatedMessages, botMessage];
            setMessages(finalMessages);

            // Save bot message batch
            await updateChatHistoryInDB(finalMessages);

        } catch (err: any) {
            console.error("Error during message handling or Gemini API call:", err);
            // Add error message to UI, but don't save it to DB history
            const errorMessage: ChatMessage = {
                id: uuidv4() + '-error',
                sender: 'bot',
                text: `Sorry, I encountered an error processing your request. ${err.message}`,
                timestamp: new Date(),
            };
            setMessages(prev => [...prev, errorMessage]); // Add error locally
            // Do NOT call updateChatHistoryInDB here for the error message
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