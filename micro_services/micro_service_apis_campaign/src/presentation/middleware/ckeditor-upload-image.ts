import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { Request } from 'express';

export class CKEditorUploadImageMiddleware {

  private static uploadDir = path.join(__dirname, '../../../public/ckeditor/image');

  static getMulterInstance() {
    // Configura o storage
    const storage = multer.diskStorage({

      destination: (req, file, cb) => {
        // Garante que o diretório existe
        if (!fs.existsSync(CKEditorUploadImageMiddleware.uploadDir)) {
          fs.mkdirSync(CKEditorUploadImageMiddleware.uploadDir, { recursive: true });
        }

        cb(null, CKEditorUploadImageMiddleware.uploadDir);
      },
      
      filename: (req, file, cb) => {
        // Prefixo + nome original
        const originalname = file.originalname.replace(/\s+/g, '_'); // remove espaços
        const filename = `ckeditor-${Date.now()}-${originalname}`;
        cb(null, filename);
      }

    });

    // Filtro de arquivos suportados
    const fileFilter = (req: Request, file: Express.Multer.File, cb: multer.FileFilterCallback) => {

        const allowedMimeTypes = ['image/jpeg', 'image/jpg', 'image/png'];

        if (!allowedMimeTypes.includes(file.mimetype)) {
          cb(new Error('Formato de arquivo não suportado'));
        }
        
        cb(null, true);
    
    };

    // Instância do multer
    return multer({
      storage,
      fileFilter,
      limits: {
        fileSize: 5 * 1024 * 1024, // 5MB
      }
    });
  }
}