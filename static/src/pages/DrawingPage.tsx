import React, { useRef, useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import CanvasDraw from 'react-canvas-draw';
import { supabase } from '../lib/supabaseClient';
import { FaPaperPlane, FaUndo, FaTrash, FaSpinner, FaCheckCircle, FaExclamationTriangle, FaEraser } from 'react-icons/fa';

const CANVAS_BG_COLOR = '#ffffff'; // Set to white

const DrawingPage: React.FC = () => {
    const { channelId } = useParams<{ channelId: string }>();
    const canvasRef = useRef<CanvasDraw>(null);
    const [brushColor, setBrushColor] = useState('#000000'); // Default black
    const [previousColor, setPreviousColor] = useState('#000000'); // To restore color after erasing
    const [brushRadius, setBrushRadius] = useState(4);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);
    const [isDrawing, setIsDrawing] = useState(false); // Track if anything has been drawn
    const [isErasing, setIsErasing] = useState(false); // Track eraser state

    useEffect(() => {
        if (!channelId) {
            setError("No drawing session ID found. Please return and try generating a new QR code.");
        }
        // Optional: Set initial canvas size based on window or container
    }, [channelId]);

    const handleSendDrawing = async () => {
        if (!canvasRef.current || !channelId) {
            setError("Canvas or channel ID is missing.");
            return;
        }
        // Check if anything was actually drawn (compare to blank canvas data URL if needed, or use isDrawing state)
        if (!isDrawing) {
            setError("Please draw something before sending.");
            return;
        }

        setLoading(true);
        setError(null);
        setSuccess(null);

        try {
            // --- Get image with explicit white background --- 
            let base64ImageData = null;
            if (canvasRef.current) {
                // Access the underlying canvas elements
                const foregroundCanvas = (canvasRef.current as any)?.canvasContainer?.children[1] as HTMLCanvasElement;
                // const backgroundCanvas = (canvasRef.current as any)?.canvasContainer?.children[0] as HTMLCanvasElement; // Optional ref if needed

                if (foregroundCanvas) {
                    const width = foregroundCanvas.width;
                    const height = foregroundCanvas.height;

                    // Create a temporary canvas
                    const tempCanvas = document.createElement('canvas');
                    tempCanvas.width = width;
                    tempCanvas.height = height;
                    const ctx = tempCanvas.getContext('2d');

                    if (ctx) {
                        // Fill with white background
                        ctx.fillStyle = '#ffffff';
                        ctx.fillRect(0, 0, width, height);

                        // Draw the existing canvas content onto the temp canvas
                        // The foregroundCanvas contains the actual drawing
                        ctx.drawImage(foregroundCanvas, 0, 0);

                        // Export from the temporary canvas
                        base64ImageData = tempCanvas.toDataURL('image/png');
                        console.log("Exported drawing with forced white background.");
                    } else {
                        console.error("Could not get 2D context from temporary canvas.");
                    }
                } else {
                    console.error("Could not find the foreground canvas element within react-canvas-draw.");
                }
            }
            // --- End image export modification --- 

            if (!base64ImageData) {
                throw new Error("Failed to get image data from canvas.");
            }

            // Add log before insert
            console.log(`Sending drawing for channel ID: ${channelId}`);
            // Insert into Supabase table `drawing_updates`
            const { error: insertError } = await supabase
                .from('drawing_updates')
                .insert({
                    channel_id: channelId,
                    base64image: base64ImageData // Match schema: lowercase 'i'
                });

            if (insertError) {
                console.error("Error sending drawing update:", insertError);
                throw new Error(`Failed to send drawing: ${insertError.message}`);
            }

            setSuccess("Drawing sent successfully!");
            // Optionally clear the canvas or disable sending again?
            // canvasRef.current.clear();
            // setIsDrawing(false);
            setTimeout(() => setSuccess(null), 3000); // Clear success message after 3s

        } catch (err: any) {
            setError(err.message || "An unknown error occurred while sending the drawing.");
        } finally {
            setLoading(false);
        }
    };

    const handleClear = () => {
        if (canvasRef.current) {
            canvasRef.current.clear();
            setIsDrawing(false); // Reset drawing state
            setError(null); // Clear error message on clear
            setIsErasing(false); // Turn off eraser if clearing
            setBrushColor(previousColor); // Restore original color
        }
    };

    const handleUndo = () => {
        if (canvasRef.current) {
            canvasRef.current.undo();
            // Note: We can't easily tell if the canvas is empty after undo with react-canvas-draw
            // We'll rely on the user not sending a blank canvas after undoing everything.
        }
    };

    const handleToggleEraser = () => {
        setIsErasing(prev => {
            const nextIsErasing = !prev;
            if (nextIsErasing) {
                // Entering eraser mode
                setPreviousColor(brushColor); // Store current color
                setBrushColor(CANVAS_BG_COLOR); // Set brush to background color
            } else {
                // Exiting eraser mode
                setBrushColor(previousColor); // Restore previous color
            }
            return nextIsErasing;
        });
    };

    // Function to detect drawing start
    const handleDrawStart = () => {
        setIsDrawing(true);
        setError(null); // Clear error message when user starts drawing
        // If erasing, ensure brush color is set correctly (it should be already, but belt-and-suspenders)
        if (isErasing) {
            setBrushColor(CANVAS_BG_COLOR);
        }
    };

    // Update color picker without exiting eraser mode
    const handleColorChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newColor = e.target.value;
        setBrushColor(newColor);
        setPreviousColor(newColor); // Also update previous color if user picks a new one
        setIsErasing(false); // Selecting a new color always disables the eraser
    };

    return (
        <div className="min-h-screen flex flex-col items-center justify-center bg-gray-100 p-4 font-sans">
            <div className="w-full max-w-4xl bg-white rounded-lg shadow-xl p-6 border border-gray-200">
                <h1 className="text-2xl font-bold text-center text-gray-800 mb-4">Draw Visit Notes</h1>
                <p className="text-center text-gray-600 text-sm mb-6">
                    Draw your notes below. When finished, click "Send to Clinician".
                </p>

                {/* Error/Success Messages */}
                <div className="mb-4 min-h-[40px] flex justify-center">
                    {error && (
                        <div className="flex items-center bg-red-100 border border-red-400 text-red-700 px-4 py-2 rounded-md text-sm animate-fade-in w-full max-w-lg">
                            <FaExclamationTriangle className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>{error}</span>
                        </div>
                    )}
                    {success && (
                        <div className="flex items-center bg-green-100 border border-green-400 text-green-700 px-4 py-2 rounded-md text-sm animate-fade-in w-full max-w-lg">
                            <FaCheckCircle className="h-4 w-4 mr-2 flex-shrink-0" />
                            <span>{success}</span>
                        </div>
                    )}
                </div>

                {/* Canvas Controls - Increased gap and added margins */}
                <div className="flex flex-wrap justify-center items-center gap-x-6 gap-y-4 mb-4"> {/* Increased gap */}
                    <button onClick={handleUndo} className="flex items-center px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 transition text-sm disabled:opacity-50" title="Undo Last Stroke" disabled={loading}>
                        <FaUndo className="mr-2 h-4 w-4" /> Undo
                    </button>
                    <button onClick={handleClear} className="flex items-center px-4 py-2 bg-red-100 text-red-600 rounded hover:bg-red-200 transition text-sm disabled:opacity-50" title="Clear Canvas" disabled={loading}>
                        <FaTrash className="mr-2 h-4 w-4" /> Clear
                    </button>
                    {/* Eraser Button - Added mr-6 for spacing */}
                    <button
                        onClick={handleToggleEraser}
                        className={`flex items-center px-4 py-2 rounded transition text-sm disabled:opacity-50 mr-6 ${isErasing ? 'bg-blue-200 text-blue-800' : 'bg-gray-200 text-gray-700 hover:bg-gray-300'}`}
                        title="Toggle Eraser"
                        disabled={loading}
                    >
                        <FaEraser className="mr-2 h-4 w-4" /> {isErasing ? 'Drawing' : 'Eraser'}
                    </button>

                    <div className="flex items-center space-x-2">
                        <label htmlFor="brushRadius" className="text-sm text-gray-600">Size:</label>
                        <input
                            id="brushRadius"
                            type="range"
                            min="1"
                            max="20"
                            value={brushRadius}
                            onChange={(e) => setBrushRadius(parseInt(e.target.value, 10))}
                            className="w-24 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-500"
                            disabled={loading}
                        />
                    </div>
                    <div className="flex items-center space-x-2">
                        <label htmlFor="brushColor" className="text-sm text-gray-600">Color:</label>
                        <input
                            id="brushColor"
                            type="color"
                            value={isErasing ? previousColor : brushColor} // Show stored color even when erasing
                            onChange={handleColorChange} // Use dedicated handler
                            className="w-8 h-8 border border-gray-300 rounded cursor-pointer"
                            disabled={loading}
                        />
                    </div>
                </div>

                {/* Canvas Area */}
                <div
                    className={`border-2 rounded-lg overflow-hidden shadow-inner touch-none bg-white ${isErasing ? 'border-blue-500 ring-2 ring-blue-300' : 'border-gray-300'}`}
                    // Add mouse/touch listeners to detect drawing start
                    onMouseDown={handleDrawStart}
                    onTouchStart={handleDrawStart}
                >
                    <CanvasDraw
                        ref={canvasRef}
                        brushColor={brushColor} // This is now dynamically set
                        brushRadius={brushRadius}
                        lazyRadius={2} // Add back lazyRadius with a lower value
                        canvasWidth={800} // <-- Try fixed width 
                        canvasHeight={700} // Increase height
                        hideGrid={true} // Hide the background grid
                        className="w-full h-full" // Keep these for container styling
                        disabled={loading || !!error && error.includes("No drawing session ID")}
                    />
                </div>

                {/* Send Button */}
                <div className="mt-6 text-center">
                    <button
                        onClick={handleSendDrawing}
                        disabled={loading || !channelId || !isDrawing || !!success} // Disable if loading, no channel, nothing drawn, or already succeeded
                        className="inline-flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition duration-150"
                    >
                        {loading ? (
                            <>
                                <FaSpinner className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" />
                                Sending...
                            </>
                        ) : (
                            <>
                                <FaPaperPlane className="-ml-1 mr-2 h-5 w-5" />
                                Send to Clinician
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};

export default DrawingPage; 