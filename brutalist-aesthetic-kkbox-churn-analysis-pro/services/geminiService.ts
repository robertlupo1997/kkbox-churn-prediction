
import { GoogleGenAI } from "@google/genai";
import { Member } from "../types";

// Always use const ai = new GoogleGenAI({apiKey: process.env.API_KEY});
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const getRiskExplanation = async (member: Member) => {
  const prompt = `
    Analyze this KKBox subscriber for churn risk:
    - Risk Score: ${member.risk_score}%
    - Auto-renew: ${member.is_auto_renew ? 'Yes' : 'No'}
    - Total Listening Time: ${member.total_secs} seconds
    - Unique Songs: ${member.num_unq}
    - Recent Transaction: ${member.last_transaction_date}
    - Member Age (bd): ${member.bd}

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
