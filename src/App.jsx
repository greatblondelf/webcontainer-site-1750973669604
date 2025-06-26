import React, { useState, useRef, useEffect } from 'react';

const HRPolicyChatbot = () => {
  const [currentStep, setCurrentStep] = useState(1);
  const [agentId, setAgentId] = useState(null);
  const [objectName, setObjectName] = useState(null);
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  const [isDarkMode, setIsDarkMode] = useState(false);
  const [apiLogs, setApiLogs] = useState([]);
  const [showApiLogs, setShowApiLogs] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  
  const fileInputRef = useRef(null);
  const messagesEndRef = useRef(null);

  const API_BASE = 'https://staging.impromptu-labs.com/api_tools';
  const API_HEADERS = {
    'Authorization': 'Bearer 37fe7c79edf25f42__-__sean',
    'Content-Type': 'application/json'
  };

  const logApiCall = (endpoint, method, payload, response) => {
    const logEntry = {
      timestamp: new Date().toISOString(),
      endpoint,
      method,
      payload: JSON.stringify(payload, null, 2),
      response: JSON.stringify(response, null, 2)
    };
    setApiLogs(prev => [...prev, logEntry]);
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleDragOver = (e) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    const files = e.dataTransfer.files;
    if (files.length > 0) {
      handleFileUpload({ target: { files } });
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file || file.type !== 'application/pdf') {
      alert('Please select a PDF file');
      return;
    }

    setCurrentStep(2);
    setIsLoading(true);
    setUploadProgress(0);
    setStatusMessage('Uploading HR policies...');

    try {
      // Convert file to base64
      const fileData = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });

      setUploadProgress(30);
      setStatusMessage('Processing document...');

      const uploadPayload = {
        created_object_name: 'hr_policies_' + Date.now(),
        data_type: 'files',
        input_data: [fileData]
      };

      // Upload the PDF
      const uploadResponse = await fetch(`${API_BASE}/input_data`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(uploadPayload)
      });

      const uploadResult = await uploadResponse.json();
      logApiCall('/input_data', 'POST', uploadPayload, uploadResult);

      if (!uploadResponse.ok) throw new Error('Failed to upload file');

      setObjectName(uploadPayload.created_object_name);
      setUploadProgress(60);
      setStatusMessage('Creating AI assistant...');

      // Create the HR policy chatbot agent
      const agentPayload = {
        instructions: `You are an HR Policy Assistant for this company. You help employees understand company policies by providing direct, concise answers based on the uploaded HR policy documents. 

Key guidelines:
- Give clear, specific answers about expense policies, meal allowances, travel rules, receipt requirements, etc.
- Be helpful and professional
- If you're unsure about something, direct them to contact HR directly
- Keep responses concise but complete
- Reference specific policy sections when relevant

You have access to the company's complete HR policy documentation to answer questions accurately.`,
        agent_name: 'HR Policy Assistant'
      };

      const agentResponse = await fetch(`${API_BASE}/create-agent`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(agentPayload)
      });

      const agentResult = await agentResponse.json();
      logApiCall('/create-agent', 'POST', agentPayload, agentResult);

      if (!agentResponse.ok) throw new Error('Failed to create agent');

      setAgentId(agentResult.agent_id);
      setUploadProgress(100);
      setStatusMessage('Setup complete!');
      
      setTimeout(() => {
        setCurrentStep(3);
        setMessages([{
          type: 'bot',
          content: 'Hi! I\'m your HR Policy Assistant. I can help you with questions about expense policies, meal allowances, travel rules, and other HR policies. What would you like to know?'
        }]);
      }, 1000);

    } catch (error) {
      console.error('Setup error:', error);
      setStatusMessage('Error setting up chatbot. Please try again.');
      logApiCall('ERROR', 'N/A', { error: error.message }, {});
    } finally {
      setIsLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!inputMessage.trim() || !agentId || isLoading) return;

    const userMessage = inputMessage.trim();
    setInputMessage('');
    setMessages(prev => [...prev, { type: 'user', content: userMessage }]);
    setIsLoading(true);

    try {
      const chatPayload = {
        agent_id: agentId,
        message: userMessage
      };

      const response = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: API_HEADERS,
        body: JSON.stringify(chatPayload)
      });

      const result = await response.json();
      logApiCall('/chat', 'POST', chatPayload, result);

      if (!response.ok) throw new Error('Failed to get response');

      setMessages(prev => [...prev, { type: 'bot', content: result.response }]);

    } catch (error) {
      console.error('Chat error:', error);
      setMessages(prev => [...prev, { 
        type: 'bot', 
        content: 'Sorry, I encountered an error. Please try asking your question again.' 
      }]);
      logApiCall('ERROR', 'N/A', { error: error.message }, {});
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const cancelSetup = () => {
    setCurrentStep(1);
    setIsLoading(false);
    setUploadProgress(0);
    setStatusMessage('');
  };

  const deleteObjects = async () => {
    if (!objectName) return;
    
    try {
      const response = await fetch(`${API_BASE}/objects/${objectName}`, {
        method: 'DELETE',
        headers: API_HEADERS
      });
      
      const result = await response.json();
      logApiCall(`/objects/${objectName}`, 'DELETE', {}, result);
      
      alert('Objects deleted successfully');
      setCurrentStep(1);
      setAgentId(null);
      setObjectName(null);
      setMessages([]);
    } catch (error) {
      console.error('Delete error:', error);
      logApiCall('ERROR', 'N/A', { error: error.message }, {});
    }
  };

  const showRawData = async () => {
    if (!objectName) return;
    
    try {
      const response = await fetch(`${API_BASE}/return_data/${objectName}`, {
        method: 'GET',
        headers: API_HEADERS
      });
      
      const result = await response.json();
      logApiCall(`/return_data/${objectName}`, 'GET', {}, result);
      
      alert(`Raw Data:\n${JSON.stringify(result, null, 2)}`);
    } catch (error) {
      console.error('Raw data error:', error);
      logApiCall('ERROR', 'N/A', { error: error.message }, {});
    }
  };

  return (
    <div className={`min-h-screen transition-colors duration-300 ${isDarkMode ? 'dark bg-gray-900' : 'bg-gray-50'}`}>
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        {/* Header */}
        <div className="flex justify-between items-center mb-8">
          <div className="flex items-center space-x-4">
            <div className="w-10 h-10 bg-primary-500 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-lg">HR</span>
            </div>
            <h1 className={`text-3xl font-bold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
              HR Policy Assistant
            </h1>
          </div>
          <div className="flex items-center space-x-4">
            <button
              onClick={() => setIsDarkMode(!isDarkMode)}
              className={`px-4 py-2 rounded-lg transition-colors ${
                isDarkMode 
                  ? 'bg-gray-700 text-white hover:bg-gray-600' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              } border`}
              aria-label="Toggle dark mode"
            >
              {isDarkMode ? '☀️' : '🌙'}
            </button>
            {objectName && (
              <>
                <button
                  onClick={showRawData}
                  className="px-4 py-2 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
                  aria-label="Show raw API data"
                >
                  Show Raw Data
                </button>
                <button
                  onClick={deleteObjects}
                  className="px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
                  aria-label="Delete created objects"
                >
                  Delete Objects
                </button>
              </>
            )}
          </div>
        </div>

        {/* Progress Steps */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-4">
            {[1, 2, 3].map((step) => (
              <div key={step} className="flex items-center">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center font-semibold ${
                  currentStep >= step 
                    ? 'bg-primary-500 text-white' 
                    : isDarkMode 
                      ? 'bg-gray-700 text-gray-400' 
                      : 'bg-gray-200 text-gray-500'
                }`}>
                  {step}
                </div>
                {step < 3 && (
                  <div className={`w-16 h-1 mx-2 ${
                    currentStep > step 
                      ? 'bg-primary-500' 
                      : isDarkMode 
                        ? 'bg-gray-700' 
                        : 'bg-gray-200'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: File Upload */}
        {currentStep === 1 && (
          <div className="max-w-2xl mx-auto">
            <div 
              className={`border-2 border-dashed rounded-2xl p-12 text-center transition-all duration-300 ${
                dragOver 
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20' 
                  : isDarkMode 
                    ? 'border-gray-600 bg-gray-800 hover:border-gray-500' 
                    : 'border-gray-300 bg-white hover:border-primary-300'
              }`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
            >
              <div className="w-16 h-16 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
              </div>
              <h3 className={`text-xl font-semibold mb-2 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Upload HR Policies
              </h3>
              <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                Drag and drop your PDF file here, or click to browse
              </p>
              <input
                type="file"
                accept=".pdf"
                onChange={handleFileUpload}
                ref={fileInputRef}
                className="hidden"
                aria-label="Upload HR policy PDF file"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="px-8 py-3 bg-primary-500 text-white rounded-xl hover:bg-primary-600 transition-colors font-medium"
              >
                Choose File
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Processing */}
        {currentStep === 2 && (
          <div className="max-w-2xl mx-auto">
            <div className={`rounded-2xl p-8 text-center ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            } shadow-lg`}>
              <div className="spinner mx-auto mb-6"></div>
              <h3 className={`text-xl font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                Processing Your HR Policies
              </h3>
              <div className={`w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3 mb-4`}>
                <div 
                  className="bg-primary-500 h-3 rounded-full transition-all duration-500"
                  style={{ width: `${uploadProgress}%` }}
                ></div>
              </div>
              <p className={`mb-6 ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                {statusMessage}
              </p>
              <button
                onClick={cancelSetup}
                className={`px-6 py-2 rounded-lg transition-colors ${
                  isDarkMode 
                    ? 'bg-gray-700 text-white hover:bg-gray-600' 
                    : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                }`}
                aria-label="Cancel setup process"
              >
                Cancel
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Chat Interface */}
        {currentStep === 3 && (
          <div className="max-w-4xl mx-auto">
            <div className={`rounded-2xl shadow-xl overflow-hidden ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            }`}>
              {/* Chat Header */}
              <div className={`px-6 py-4 border-b ${
                isDarkMode ? 'border-gray-700 bg-gray-750' : 'border-gray-200 bg-gray-50'
              }`}>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                    <span className="text-white text-sm font-bold">AI</span>
                  </div>
                  <div>
                    <h3 className={`font-semibold ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                      HR Policy Assistant
                    </h3>
                    <p className={`text-sm ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                      Online • Ready to help
                    </p>
                  </div>
                </div>
              </div>

              {/* Messages */}
              <div 
                className={`h-96 overflow-y-auto p-6 space-y-4 ${
                  isDarkMode ? 'bg-gray-900' : 'bg-gray-50'
                }`}
                aria-live="polite"
                aria-label="Chat messages"
              >
                {messages.map((message, index) => (
                  <div
                    key={index}
                    className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'}`}
                  >
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                      message.type === 'user'
                        ? 'bg-primary-500 text-white'
                        : isDarkMode
                          ? 'bg-gray-700 text-white'
                          : 'bg-white text-gray-900 border'
                    }`}>
                      {message.content}
                    </div>
                  </div>
                ))}
                {isLoading && (
                  <div className="flex justify-start">
                    <div className={`px-4 py-3 rounded-2xl ${
                      isDarkMode ? 'bg-gray-700 text-white' : 'bg-white text-gray-900 border'
                    }`}>
                      <div className="flex items-center space-x-2">
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
                        <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>

              {/* Input Area */}
              <div className={`p-6 border-t ${
                isDarkMode ? 'border-gray-700 bg-gray-800' : 'border-gray-200 bg-white'
              }`}>
                <div className="flex space-x-4">
                  <input
                    type="text"
                    value={inputMessage}
                    onChange={(e) => setInputMessage(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="Ask me anything about HR policies..."
                    className={`flex-1 px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-primary-500 ${
                      isDarkMode 
                        ? 'bg-gray-700 border-gray-600 text-white placeholder-gray-400' 
                        : 'bg-white border-gray-300 text-gray-900 placeholder-gray-500'
                    }`}
                    disabled={isLoading}
                    aria-label="Type your question about HR policies"
                  />
                  <button
                    onClick={sendMessage}
                    disabled={isLoading || !inputMessage.trim()}
                    className="px-6 py-3 bg-green-500 text-white rounded-xl hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
                    aria-label="Send message"
                  >
                    Send
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* API Logs Toggle */}
        <div className="mt-8 text-center">
          <button
            onClick={() => setShowApiLogs(!showApiLogs)}
            className={`px-4 py-2 rounded-lg transition-colors ${
              isDarkMode 
                ? 'bg-gray-700 text-white hover:bg-gray-600' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            {showApiLogs ? 'Hide' : 'Show'} API Debug Logs
          </button>
        </div>

        {/* API Logs */}
        {showApiLogs && (
          <div className="mt-4">
            <div className={`rounded-lg p-4 ${
              isDarkMode ? 'bg-gray-800' : 'bg-white'
            } border max-h-96 overflow-y-auto`}>
              <h3 className={`font-semibold mb-4 ${isDarkMode ? 'text-white' : 'text-gray-900'}`}>
                API Debug Logs
              </h3>
              {apiLogs.length === 0 ? (
                <p className={isDarkMode ? 'text-gray-400' : 'text-gray-500'}>
                  No API calls yet
                </p>
              ) : (
                <div className="space-y-4">
                  {apiLogs.map((log, index) => (
                    <div key={index} className={`p-3 rounded border-l-4 border-primary-500 ${
                      isDarkMode ? 'bg-gray-700' : 'bg-gray-50'
                    }`}>
                      <div className="flex justify-between items-start mb-2">
                        <span className={`font-mono text-sm ${isDarkMode ? 'text-green-400' : 'text-green-600'}`}>
                          {log.method} {log.endpoint}
                        </span>
                        <span className={`text-xs ${isDarkMode ? 'text-gray-400' : 'text-gray-500'}`}>
                          {new Date(log.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <details className="mt-2">
                        <summary className={`cursor-pointer text-sm ${isDarkMode ? 'text-gray-300' : 'text-gray-600'}`}>
                          View Details
                        </summary>
                        <div className="mt-2 space-y-2">
                          <div>
                            <strong className={isDarkMode ? 'text-white' : 'text-gray-900'}>Request:</strong>
                            <pre className={`text-xs mt-1 p-2 rounded overflow-x-auto ${
                              isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {log.payload}
                            </pre>
                          </div>
                          <div>
                            <strong className={isDarkMode ? 'text-white' : 'text-gray-900'}>Response:</strong>
                            <pre className={`text-xs mt-1 p-2 rounded overflow-x-auto ${
                              isDarkMode ? 'bg-gray-800 text-gray-300' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {log.response}
                            </pre>
                          </div>
                        </div>
                      </details>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default HRPolicyChatbot;
