
import { GoogleGenAI } from "@google/genai";
import { Member } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getRiskExplanation = async (member: Member) => {
  const prompt = `
    Analyze this KKBox subscriber for churn risk:
    - Risk Score: ${(member.risk_score * 100).toFixed(1)}%
    - Risk Tier: ${member.risk_tier}
    - Churn Status: ${member.is_churn ? 'Churned' : 'Active'}
    - Top Risk Factors: ${member.top_risk_factors.join(', ')}
    - Recommended Action: ${member.action_recommendation}

    Explain in plain English why this user is a ${member.risk_tier} churn risk and provide 3 actionable recommendations for the customer success team to retain them.
    Return as a clean Markdown object with 'explanation' and 'recommendations' sections.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    // Extracting Text Output from GenerateContentResponse using the .text property.
    return response.text;
  } catch (error) {
    console.error("Gemini API Error:", error);
    return "Error generating risk assessment. Please try again later.";
  }
};
