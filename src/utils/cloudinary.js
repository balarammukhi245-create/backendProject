import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs';

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    apui_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET
});

const uploadToCloudinary = async (localFilePath)=>{
    try {
        if (!localFilePath) return null;
        const response = await cloudinary.uploader.upload
        (localFilePath, {
            resource_type: "auto"
        })
        // file uploaded to coludinary successfully
        console.log(`File uploaded to Cloudinary successfully: ${response.url}`);
        return response;
        
    } catch (error) {
        fs.unlinkSync(localFilePath) // remove the file from local storage in case of upload operation failed or error
       return null; 
    } 
}

export {uploadToCloudinary};