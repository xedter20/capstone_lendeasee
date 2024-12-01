import express from 'express';

import config from '../config.js';

import {
  authenticateUserMiddleware,
  auditTrailMiddleware
} from '../middleware/authMiddleware.js';

let db = config.mySqlDriver;
import { v4 as uuidv4 } from 'uuid';
const router = express.Router();

import multer from 'multer';
const upload = multer({ storage: multer.memoryStorage() });
let firebaseStorage = config.firebaseStorage;
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';

router.post(
  '/create',
  authenticateUserMiddleware,

  async (req, res) => {
    const data = req.body;

    const { proposed_loan_amount, loan_type, loan_type_specific } = data;

    let { user_id } = req.user;
    console.log({ data });

    let borrower_id = user_id;

    // map to db
    let loan_application_id = uuidv4();
    let loan_amount = proposed_loan_amount;

    let loan_type_value = loan_type || loan_type_specific;
    let interest_rate = 5;
    let loan_status = 'Pending';
    let purpose = loan_type_specific;
    let remarks = '';

    try {
      await db.query(
        `INSERT INTO loan_application (application_id, borrower_id, loan_amount, status, qr_code_id)
       VALUES (?, ?, ?, ?, ?)`,
        [loan_application_id, borrower_id, loan_amount, loan_status, 1]
      );

      //  insert into loan table

      await db.query(
        `INSERT INTO loan 
        (
       loan_application_id, 
       borrower_id, 
       loan_type_value,
       loan_amount, 
       interest_rate, 
       loan_status, 
       purpose, 
       remarks) 
       VALUES ( ?, ?, ?, ?, ? ,?, ?,?)`,
        [
          loan_application_id,
          borrower_id,
          loan_type_value,
          loan_amount,
          interest_rate,
          loan_status,
          purpose,
          remarks
        ]
      );

      // insert QR CODE
      await db.query(`INSERT INTO qr_code ( code, type) VALUES ( ?, ?)`, [
        loan_application_id,
        'Loan Application'
      ]);

      res.status(201).json({
        success: true,
        message: 'Loan application created successfully',
        data: {
          loan_application_id
        }
      });
    } catch (err) {
      console.error(err); // Log the error for debugging
      res.status(500).json({
        success: false,
        message:
          'An error occurred while creating the loan application. Please try again later.'
      });
    }
  }
);

// Route to handle file uploads
router.post(
  '/upload-files',
  upload.fields([
    { name: 'bankStatement', maxCount: 1 },
    { name: 'borrowerValidID', maxCount: 1 },
    { name: 'coMakersValidID', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      const files = req.files;

      const loan_application_id = req.body.loan_application_id;

      console.log({ loan_application_id });

      // Upload each file to Firebase Storage
      for (const [key, fileArray] of Object.entries(files)) {
        console.log('dex');
        const file = fileArray[0];

        const storageRef = ref(
          firebaseStorage,
          `lendease/loans/${loan_application_id}/${file.originalname}`
        );
        const metadata = { contentType: file.mimetype };

        // // Upload the file to Firebase Storage
        await uploadBytes(storageRef, file.buffer, metadata);

        // // Get the file's download URL
        // const downloadURL = await getDownloadURL(storageRef);
        // console.log({ downloadURL });
        console.log(`${key} uploaded successfully.`);
      }

      res.status(200).json({ message: 'Files uploaded successfully!' });
    } catch (error) {
      console.error('Error uploading files:', error);
      res.status(500).json({ error: 'Failed to upload files.' });
    }
  }
);

export default router;