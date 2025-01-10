import OpenAI from "openai"
import { JWT } from "google-auth-library";
import { GoogleSpreadsheet } from "google-spreadsheet";
import dotenv from "dotenv";
dotenv.config();

interface VideoData {
    id: string;
    transcript: string;
    violated_reason: string;
    start: number;
    end: number;
    video_link: string;
    timestamp_link: string;
}

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

function formatTime(seconds: number): string {
    if (seconds >= 3600) {
        const hours = Math.floor(seconds / 3600);
        const minutes = Math.floor((seconds % 3600) / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${hours}:${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function createTimestampLink(videoLink: string, startTime: number): string {
    if (videoLink.includes("youtube.com")) {
        return `${videoLink}?t=${Math.floor(startTime)}`;
    }

    return videoLink;
}

// export async function updateGoogleSheet(): Promise<void> {
//     const serviceAccountAuth = new JWT({
//         email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
//         key: process.env.GOOGLE_PRIVATE_KEY,
//         scopes: ['https://www.googleapis.com/auth/spreadsheets'],
//     });

//     const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID as string, serviceAccountAuth);
//     await doc.loadInfo();

//     let sheet = doc.sheetsByTitle[process.env.SHEET_NAME_PATREON as string];
//     if (!sheet) {
//         throw new Error('Sheet not found');
//     }

//     await sheet.loadHeaderRow();
//     const rows = await sheet.getRows();

//     const data: VideoData[] = rows.map(row => ({
//         id: row.get('id'),
//         transcript: row.get('transcript'),
//         violated_reason: row.get('violated_reason'),
//         start: row.get('start'),
//         end: row.get('end'),
//         video_link: row.get('video_link'),
//         timestamp_link: row.get('timestamp_link')
//     }));

//     await sheet.clearRows();
//     // console.log("rows------>", data);
//     const checkViolationsPrompt = `  
//  I will give you the statement: recording of a youtube video from a youtuber, and the analysis result of that video by a lawyer.
// Your task is to tell me if analysis is correct or not.
// They might be wrong, as they are done by beginner lawyer.
// Please be short and concise in your answer. 
// You must decide whether the analysis is correct and provide bullet points why its correct, or if its wrong, and bullet points to explain why its wrong.`;

//     let updatedRows: VideoData[] = [];

//     for (const datum of data) {
//         try {
//             const response = await openai.chat.completions.create({
//                 model: "gpt-4o",
//                 messages: [
//                     { role: "system", content: "You are a legal assistant specializing in Czech law." },
//                     { role: "user", content: checkViolationsPrompt },
//                 ],
//             });

//             // Validate the response structure  
//             if (response.choices && response.choices.length > 0) {
//                 const violationCheckReAnalysis = response.choices[0]?.message?.content?.trim() || "";
//                 console.log("Analysis Check Response:", violationCheckReAnalysis);

//                 // Check if the response indicates a violation  
//                 if (violationCheckReAnalysis.contains("Incorrect")) {
//                     // Extract the violated reason using a more robust extraction method  
//                     const violatedReasonPrefix = "Violated reason: ";
//                     const violatedReasonIndex = violationCheckReAnalysis.indexOf(violatedReasonPrefix);
//                     let violatedReason = "";

//                     if (violatedReasonIndex !== -1) {
//                         // Extract the reason correctly  
//                         violatedReason = violationCheckReAnalysis.substring(violatedReasonIndex + violatedReasonPrefix.length).trim();
//                     }

//                     // Store the result with the violated reason  
//                     updatedRows.push(datum);
//                 }

//             } else {
//                 console.error("No choices returned in the response for sentence:", text);
//             }

//         } catch (error) {
//             console.error("Error checking violation for sentence:", text, "Error:", error);
//         }
//     }

//     // Add updated rows
//     // const updatedRows = data.map(item => ({
//     //     id: item.id,
//     //     transcript: item.transcript,
//     //     violated_reason: item.violated_reason,
//     //     start: formatTime(item.start),
//     //     end: formatTime(item.end),
//     //     video_link: item.video_link.split('&feature=')[0],
//     //     timestamp_link: createTimestampLink(item.video_link.split('&feature=')[0], item.start)
//     // }));

//     await sheet.addRows(updatedRows);
//     console.log("updatedRows------>", updatedRows);
//     console.log("Google Sheets updated successfully.");
// }

export async function updateGoogleSheet(): Promise<void> {
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID as string, serviceAccountAuth);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle[process.env.SHEET_NAME_PATREON as string];
    let updatedSheet = doc.sheetsByTitle[process.env.SHEET_NAME_PATREON_UPDATED as string];
    if (!sheet && !updatedSheet) {
        throw new Error('Sheets not found');
    }

    await sheet.loadHeaderRow();
    await updatedSheet.loadHeaderRow();
    const rows = await sheet.getRows();

    const data: VideoData[] = rows.map(row => ({
        id: row.get('id'),
        transcript: row.get('transcript'),
        violated_reason: row.get('violated_reason'),
        start: row.get('start'),
        end: row.get('end'),
        video_link: row.get('video_link'),
        timestamp_link: row.get('timestamp_link')
    }));

    console.log("rows length------>", data.length);

    // await sheet.clearRows();

    for (const row of data) {
        try {
            const analysisPrompt = `
            Video Transcript: ${row.transcript}
            Current Analysis: ${row.violated_reason}

            Please analyze if this legal analysis is correct or incorrect based on Czech law.
            Provide a clear "CORRECT" or "INCORRECT" at the start of your response, followed by bullet points explaining why.`;

            const response = await openai.chat.completions.create({
                model: "gpt-4",
                messages: [
                    { role: "system", content: "You are a legal assistant specializing in Czech law." },
                    { role: "user", content: analysisPrompt },
                ],
            });

            if (response.choices && response.choices.length > 0) {
                const analysis = response.choices[0]?.message?.content?.trim() || "";
                console.log("Analysis for ID:", row.id, ":", analysis);

                if (analysis.startsWith("CORRECT")) {
                    await updatedSheet.addRow({
                        id: row.id,
                        transcript: row.transcript,
                        violated_reason: row.violated_reason,
                        start: row.start,
                        end: row.end,
                        video_link: row.video_link,
                        timestamp_link: row.timestamp_link
                    });
                }
            }
        } catch (error) {
            console.error("Error analyzing violation for ID:", row.id, "Error:", error);
        }
    }

    console.log("Google Sheets updated successfully.");
}

updateGoogleSheet();