import axios from "axios";
import * as dotenv from "dotenv";
dotenv.config();

export default class KaulizHelper {
    static kaulizApiKey = process.env.CAMPAIGN_KAULIZ_API_KEY as string;
    static kaulizURL = process.env.CAMPAIGN_KAULIZ_URL_CHECK_MESSAGE_STATUS as string;
    static kaulizUploadFileURL = process.env.CAMPAIGN_KAULIZ_URL_UPLOAD_IMAGE as string;

    static async getStatus(idStatus: number) {
        console.log('IDS no helper: ', idStatus);
        
        let statusSent: number = 3;

        const payload = {
            queueId: 20,
            apiKey: this.kaulizApiKey,
            enqueuedId: idStatus,
        };

        console.log(`🔍 Enviando para Kauliz:`, payload);

        try {
            const response = await axios.post( this.kaulizURL, payload );

            // console.log('Resposta do KAULIZ: ', response);
            console.log('Resposta do KAULIZ: ', response.data.status);

            if (response.data.status === 1) {
                console.log('helper - status 1 entra aqui');
                statusSent = 1;
            } else if(response.data.status === 0) {
                console.log('helper - status 0 entra aqui');
                statusSent = 0;
            }
            
        } catch (error: any) {
            console.error('❌ Erro na requisição Kauliz:', error.response?.data || error.message);
        }

        return statusSent;
    }

    static async uploadImage(imageBase64: string, templateName: string, mimeType: string) {
        // console.log('IDS no helper: ', imageBase64);
        
        // let statusSent: number = 3;
        imageBase64 = imageBase64.split(',')[1];

        const payload = {
            fileName: `fotoCampanha${templateName}.jpg`,
            mimeType: "image/jpg",
            data: imageBase64,
            thumbnail: imageBase64,
            width: 1000, //-> Dúvida qual tamanho aconselhado
            height: 1000,
            saveToGallery: true,
            title: `foto campanha ${templateName}`,
            queueId: 20,
            apiKey: this.kaulizApiKey
        };

        console.log(`🔍 Enviando para Kauliz:`, payload);

        try {
            const response = await axios.post( this.kaulizUploadFileURL, payload , { headers: { 'Content-Type': 'application/json' } });

            console.log('Resposta do KAULIZ: ', response);
            console.log('Resposta do KAULIZ: ', response.data.status);
            console.log('Resposta do KAULIZ: ', response.data.fileId);
            const fileId = response.data.fileId;

            if (fileId) {
                return fileId;
            }

            // if (response.data.status === 1) {
            //     console.log('helper - status 1 entra aqui');
            //     statusSent = 1;
            // } else if(response.data.status === 0) {
            //     console.log('helper - status 0 entra aqui');
            //     statusSent = 0;
            // }
            
        } catch (error: any) {
            console.error('❌ Erro na requisição Kauliz:', error.response?.data || error.message);
        }

        console.log('Deu certo o Kauliz');
        
        return;
    }
}