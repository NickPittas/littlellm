// Test script to debug Mistral API issues
// Run with: node test-mistral-api.js

const API_KEY = process.env.MISTRAL_API_KEY || 'your-api-key-here';
const BASE_URL = 'https://api.mistral.ai/v1';

async function testMistralAPI() {
  console.log('🧪 Testing Mistral AI API...');
  console.log(`Base URL: ${BASE_URL}`);
  console.log(`API Key: ${API_KEY ? `${API_KEY.substring(0, 8)}...` : 'NOT PROVIDED'}`);
  
  if (!API_KEY || API_KEY === 'your-api-key-here') {
    console.error('❌ Please set MISTRAL_API_KEY environment variable');
    return;
  }

  // Test 1: List models
  console.log('\n📋 Test 1: List available models');
  try {
    const modelsResponse = await fetch(`${BASE_URL}/models`, {
      headers: {
        'Authorization': `Bearer ${API_KEY}`,
        'Content-Type': 'application/json',
        'User-Agent': 'LittleLLM/1.0'
      }
    });

    console.log(`Models API Status: ${modelsResponse.status} ${modelsResponse.statusText}`);
    
    if (modelsResponse.ok) {
      const modelsData = await modelsResponse.json();
      console.log('✅ Models fetched successfully');
      console.log(`Available models: ${modelsData.data?.map(m => m.id).join(', ')}`);
    } else {
      const errorText = await modelsResponse.text();
      console.error('❌ Models API failed:', errorText);
    }
  } catch (error) {
    console.error('❌ Models API error:', error.message);
  }

  // Test 2: Simple chat completion
  console.log('\n💬 Test 2: Simple chat completion');
  try {
    const chatResponse = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'User-Agent': 'LittleLLM/1.0'
      },
      body: JSON.stringify({
        model: 'mistral-small-latest',
        messages: [
          { role: 'user', content: 'Hello! Please respond with just "Hi there!"' }
        ],
        max_tokens: 10,
        temperature: 0.1
      })
    });

    console.log(`Chat API Status: ${chatResponse.status} ${chatResponse.statusText}`);
    
    if (chatResponse.ok) {
      const chatData = await chatResponse.json();
      console.log('✅ Chat completion successful');
      console.log(`Response: ${chatData.choices?.[0]?.message?.content}`);
    } else {
      const errorText = await chatResponse.text();
      console.error('❌ Chat API failed:', errorText);
      
      // Try to parse error for better details
      try {
        const errorObj = JSON.parse(errorText);
        console.error('Error details:', errorObj);
      } catch (e) {
        console.error('Raw error:', errorText);
      }
    }
  } catch (error) {
    console.error('❌ Chat API error:', error.message);
  }

  // Test 3: Chat completion with vision model (if available)
  console.log('\n🖼️ Test 3: Vision model test');
  try {
    const visionResponse = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'User-Agent': 'LittleLLM/1.0'
      },
      body: JSON.stringify({
        model: 'mistral-medium-latest', // Use vision-capable model
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What do you see in this image?' },
              {
                type: 'image_url',
                image_url: { url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/d/dd/Gfp-wisconsin-madison-the-nature-boardwalk.jpg/2560px-Gfp-wisconsin-madison-the-nature-boardwalk.jpg' }
              }
            ]
          }
        ],
        max_tokens: 50
      })
    });

    console.log(`Vision API Status: ${visionResponse.status} ${visionResponse.statusText}`);

    if (visionResponse.ok) {
      const visionData = await visionResponse.json();
      console.log('✅ Vision model test successful');
      console.log(`Response: ${visionData.choices?.[0]?.message?.content}`);
    } else {
      const errorText = await visionResponse.text();
      console.error('❌ Vision API failed:', errorText);
    }
  } catch (error) {
    console.error('❌ Vision API error:', error.message);
  }

  // Test 4: Test non-vision model with text (should work)
  console.log('\n📝 Test 4: Reasoning model test (magistral)');
  try {
    const reasoningResponse = await fetch(`${BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${API_KEY}`,
        'User-Agent': 'LittleLLM/1.0'
      },
      body: JSON.stringify({
        model: 'magistral-medium-latest',
        messages: [
          { role: 'user', content: 'Solve this step by step: What is 15 * 23?' }
        ],
        max_tokens: 100
      })
    });

    console.log(`Reasoning API Status: ${reasoningResponse.status} ${reasoningResponse.statusText}`);

    if (reasoningResponse.ok) {
      const reasoningData = await reasoningResponse.json();
      console.log('✅ Reasoning model test successful');
      console.log(`Response: ${reasoningData.choices?.[0]?.message?.content}`);
    } else {
      const errorText = await reasoningResponse.text();
      console.error('❌ Reasoning API failed:', errorText);
    }
  } catch (error) {
    console.error('❌ Reasoning API error:', error.message);
  }

  console.log('\n🏁 Test completed');
}

// Run the test
testMistralAPI().catch(console.error);
