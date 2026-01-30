import { asyncHandler } from "../utils/asyncHandler.js";
import ApiError from "../utils/ApiError.js";
import {User} from "../models/user.models.js";
import {cloudinaryUpload, uploadToCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
const registerUser = asyncHandler( async (req,res)=>{
    // Logic for registering a user
    //get user details from frontend
    // validation -noempty fields
    // check if user already exists: username or email
    // check for images, and avatar
    //upload image to cloudinary
    //create user object- create entry in db
    //remove password and refresh token fild from response
    // check for user creation
    //return response

    const {username, email, fullname, password }=req.body
    console.log(username, email, fullname, password);

    // if (fullname === ""){
    //     throw new ApiError(400, "FullName is Required")
    // }

    if ( [fullname, email, username, password].some((field)=> field?.trim()=== "")){
        throw new ApiError(400, "All fields are required")
    }

    const existedUser = await User.findOne({
        $or: [{ username }, { email }]
    })
 

    if (existedUser){
        throw new ApiError(409, "User already exists with this username or email")
    }

    const avatarLocalPath = req.files?.avatar[0]?.path;
    console.log("avatarLocalPath", avatarLocalPath);

    const coverImageLocalPath = req.files?.coverImage[0]?.path;
    console.log("coverImageLocalPath", coverImageLocalPath);

    if (!avatarLocalPath){
        throw new ApiError(400, "Avatar file is required")
    }

    const avatar =  await uploadToCloudinary(avatarLocalPath)
    const coverImage = await uploadToCloudinary(coverImageLocalPath)

    if(!avatar){
        throw new ApiError (500, "Failed to upload avatar image")
    }

  const user = await User.create({
        fullname,
        avatar: avatar.url,
        coverImage: coverImage?.url || "",
        username: username.toLowerCase(),
        email,
        password,
    })

   const createdUser = await User.findById(user._id).select(
    "-password -refreshToken"
   )
   if (!createdUser){
    throw new ApiError(500, "User registration failed")
   }

   return res.status(201).json(
    new ApiResponse(200, createdUser, "User registered successfully")
   )
})

export {registerUser}