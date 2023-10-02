import axios from "axios";

const AGNOSTIC_ENDPOINT = "https://proxy.eu-02.agnostic.engineering/query";

export const agnosticFetch = async (query: string): Promise<any> => {
    try {
        const response = await axios.post(AGNOSTIC_ENDPOINT, query, {
            headers: {
                'Authorization': `${process.env.AGNOSTIC_API_KEY}`,
                "Cache-Control": "max-age=300"
            }
        });

        return response.data.rows;
    }
    catch (e) {
        console.error(e);
        return [];
    }
}