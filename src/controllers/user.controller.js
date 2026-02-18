import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import {User} from "../models/user.models.js";
import {uploadToCloudinary} from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";

const generateAccessAndRefreshTokens = async (userId) => {
    try {
       const user =  await User.findById(userId)
      const accessToken = user.generateAccessToken()
      const refreshToken = user.generateRefreshToken()

      user.refreshToken = refreshToken
      await user.save({validateBeforeSave: false})

      return {accessToken , refreshToken}

    } catch (error) {
        throw new ApiError(500, "Failed to generate accecc and refresh tokens")
    }
}


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
 

    if (!existedUser){
        throw new ApiError(409, "User already exists with this username or email")
    }

    console.log("req.files", req.files);

    const avatarLocalPath = req.files?.avatar[0]?.path;
    console.log("avatarLocalPath", avatarLocalPath);

    // const coverImageLocalPath = req.files?.coverImage[0]?.path;
    // console.log("coverImageLocalPath", coverImageLocalPath);

    let coverImageLocalPath ;
    if (req.files && Array.isArray(req.files.coverImage) && req.files.coverImage.length > 0){
        coverImageLocalPath = req.files.coverImage[0].path
    }

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

const loginUser = asyncHandler( async (req, res)=>{
    //taking data from req.body
    // username or mail and password
    // find the user
    //password check
    //access and refresh token
    //send cookie and response

    const { username, email, password } = req.body
    if (!username && !email){
        throw new ApiError( 400, "Username or email is required")
    }

    const user = await User.findOne({
        $or: [{username}, {email}]
    })

    if (!user){
        throw new ApiError(404, "User not found with this username or email")  
    }

    const isPasswordValid= await user.isPasswordCorrect(password)

    if (!isPasswordValid){
        throw new ApiError(401, "Invalid user credentials")
    }

    const {accessToken, refreshToken} = await generateAccessAndRefreshTokens(user._id)

    const loggedInUser = await User.findById(user._id).select("-password -refreshToken")

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
        new ApiResponse(200, loggedInUser, 
            {
                user: loggedInUser, accessToken, refreshToken
            },
            "User logged in Successfully")
    )

})


const logoutUser = asyncHandler( async (req, res)=>{
   await User.findByIdAndUpdate(
        req.user._id,
        {
            $set: {
                refreshToken: undefined
            }
        },
        {
            new: true   
        }
    )

    const options = {
        httpOnly: true,
        secure: true
    }

    return res.status(200).clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(
        new ApiResponse(200, null, "User logged out successfully")
    )
})

const refreshAccessToken = asyncHandler( async (req, res)=>{
    const incomingRefreshToken = req.cookies.refreshToken || req.body.refreshToken

    if (!incomingRefreshToken){
        throw new ApiError(401, "Unauthorized request")
    }

    try {
        const decodedToken = jwt.verify(incomingRefreshToken, process.env.REFRESH_TOKEN_SECRET)
        
        const user = await User.findById(decodedToken?._id)

        if (!user){
            throw new ApiError(401, "Invalid refresh token")
        }

        if (incomingRefreshToken !== user?.refreshToken){
            throw new ApiError(401, "Invalid or expired refresh token")
        }

        const {accessToken, newrefreshToken} = await generateAccessAndRefreshTokens(user._id)
      
        const options = {
            httpOnly: true,
            secure: true
        }

        return res.status(200)
        .cookie("accessToken", accessToken, options)
        .cookie("refreshToken", newrefreshToken, options)
        .json(
            new ApiResponse(200, {accessToken, refreshToken: newrefreshToken}, "Access token refreshed successfully")
        )
    } catch (error) {
        throw new ApiError(401, error?.message || "Invalid refresh token")
    }

})

const changeCurrentPassword = asyncHandler(async(req,res)=>{
    const {oldPassword, newPassword} = req.body
    
    const user = await  User.findById(req.user?._id)
    const isPasswordCorrect = await user.isPasswordCorrect(oldPassword)

    if (!isPasswordCorrect){
        throw new ApiError(400, "Invalid old Password")
    }

    user.password = newPassword
    await user.save({validateBeforeSave: false})

    return res 
    .status(200)
    .json(new ApiResponse(200, {}, "Password change successfully"))

})

const getCurrentUser = asyncHandler(async(req,res)=>{
    return res
    .status(200)
    .json(200, req.user, "Curresnt user fetched successfully")
})

const updateAccountDetails = asyncHandler(async (req,res)=>{
    const {fullname, email} = req.body

    if (!fullname || !email){
        throw new ApiError(400, "All fields are required")
    }

    const user = await User.findByIdAndUpdate(
        req.user?._id,
        {
            $set: {
                fullname: fullname,
                email: email
            }
        },
        {new: true}
    ).select("-password")

    return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details update successfully"))
})

export {registerUser, loginUser, logoutUser, refreshAccessToken, changeCurrentPassword,
    getCurrentUser, updateAccountDetails
}