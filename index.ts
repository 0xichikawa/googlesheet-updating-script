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

function formatTime(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = Math.floor(seconds % 60);
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
}

function createTimestampLink(videoLink: string, startTime: number): string {
    return `${videoLink}?t=${Math.floor(startTime)}`;
}

export async function updateGoogleSheet(): Promise<void> {
    const serviceAccountAuth = new JWT({
        email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        key: process.env.GOOGLE_PRIVATE_KEY,
        scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    });

    const doc = new GoogleSpreadsheet(process.env.GOOGLE_SHEET_ID as string, serviceAccountAuth);
    await doc.loadInfo();

    let sheet = doc.sheetsByTitle[process.env.SHEET_NAME_YOUTUBE as string];
    if (!sheet) {
        throw new Error('Sheet not found');
    }

    await sheet.loadHeaderRow();
    const rows = await sheet.getRows();

    const data: VideoData[] = rows.map(row => ({
        id: row.get('id'),
        transcript: row.get('transcript'),
        violated_reason: row.get('violated_reason'),
        start: parseFloat(row.get('start')) || 0,
        end: parseFloat(row.get('end')) || 0,
        video_link: row.get('video_link'),
        timestamp_link: row.get('timestamp_link')
    }));

    await sheet.clearRows();

    // Add updated rows
    const updatedRows = data.map(item => ({
        id: item.id,
        transcript: item.transcript,
        violated_reason: item.violated_reason,
        start: formatTime(item.start),
        end: formatTime(item.end),
        video_link: item.video_link,
        timestamp_link: createTimestampLink(item.video_link, item.start)
    }));

    await sheet.addRows(updatedRows);
    console.log("Google Sheets updated successfully.");
}

updateGoogleSheet();