# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

**Local Development:**
```bash
vercel dev          # Start local development server
```

**Testing & Diagnostics:**
```bash
curl http://localhost:3000/api/test    # Health check endpoint
curl http://localhost:3000/api/questions    # Test question generation
```

**Environment Setup:**
```bash
cp .env.example .env    # Copy environment template
# Then add your DEEPSEEK_API_KEY to .env
```

## Architecture Overview

This is a serverless educational quiz application built for 4th grade students, deployed on Vercel with a dual-source question generation system.

**Frontend:** Vanilla HTML/CSS/JavaScript in `/public/` - no build process required
**Backend:** Node.js serverless functions in `/api/` using native fetch (Node 18+)
**Deployment:** Vercel platform with auto-scaling functions

## Key Technical Patterns

### Question Generation System
The app uses a sophisticated dual-source approach:

1. **Primary**: DeepSeek AI API generates dynamic questions via `/api/questions.js`
2. **Fallback**: Pre-written questions in `FALLBACK_QUESTIONS` array serve as backup

**Critical parsing logic** in `questions.js` handles multiple AI response formats with extensive error recovery. The parser uses regex patterns and multi-stage validation to extract structured questions from free-form AI responses.

### Data Flow Architecture
```
Frontend Request → /api/questions → DeepSeek API → Response Parser → Client
                                     ↓ (on failure)
                                  Fallback Questions → Client
```

### Rate Limiting & Security
- In-memory rate limiting: 10 requests per 5 minutes per IP (resets on cold starts)
- Security headers applied to all responses
- API key secured in environment variables
- No client-side exposure of sensitive data

### Response Format
All question endpoints return this structure:
```javascript
{
  questions: [{ content, choices, correctAnswer, explanation, funFact }],
  metadata: { source: "api"|"fallback", generated_at, duration_seconds }
}
```

## Important Implementation Details

### Question Object Structure
Each question requires exactly this format:
- `content`: String (question text)
- `choices`: Array of 4-5 strings (answer options)
- `correctAnswer`: String ("a", "b", "c", "d", or "e")
- `explanation`: String (educational explanation)
- `funFact`: String (engaging additional information)

### Frontend State Management
Critical global variables in `quiz.js`:
- `currentQuestions`: Active quiz questions array
- `userAnswers`: Object mapping question indices to selected answers  
- `quizCompleted`: Boolean flag for quiz completion state
- `lastQuizSource`: Tracks "api" vs "fallback" source for UI indicators

### Enhanced Loading Experience
The app features a sophisticated loading system with:
- Animated spinner with educational icons
- Cycling motivational tips for students
- 3-minute timeout to accommodate DeepSeek's response time
- Graceful fallback messaging when using pre-written questions

### Error Handling Strategy
Multi-layer error handling:
1. API request failures → automatic fallback questions
2. Response parsing errors → detailed logging + fallback
3. Invalid question format → validation + rejection
4. Rate limiting → clear user messaging
5. Network issues → retry logic built into frontend

## Educational Design Requirements

**Target Audience**: 4th grade students (age 9)
**Subject Coverage**: Science, Math, Geography, History, Civics, Literature, Health
**Question Variety**: Scenario-based, comparison, application, and analysis questions
**User Experience**: Kid-friendly interface with encouraging feedback and immediate explanations

## Environment Configuration

Required environment variable:
- `DEEPSEEK_API_KEY`: API key for question generation service

Optional:
- `PORT`: Local development port (defaults to 3000)

## Debugging & Troubleshooting

The `/api/test.js` endpoint provides system diagnostics including API key presence, Node version, and request details.

Common issues:
- **Empty questions**: Check API key configuration and DeepSeek service status
- **Parsing failures**: Review console logs for specific parsing error patterns
- **Rate limiting**: Monitor request frequency and implement user-facing delays if needed
- **Timeout issues**: The 3-minute limit accommodates DeepSeek's response time while preventing Vercel timeouts

## Recent Development Focus

Based on git history, recent improvements include:
- Enhanced question parsing reliability for various AI response formats
- Improved loading screen user experience with animations
- Response timeout optimization (3-minute timeout)
- Better error handling and debugging capabilities
- Question variety and educational engagement improvements