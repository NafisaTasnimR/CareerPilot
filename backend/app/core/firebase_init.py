import firebase_admin
from firebase_admin import credentials
import os
import json

def initialize_firebase():
    """Initialize Firebase Admin SDK"""
    if not firebase_admin._apps:
        # Get Firebase credentials from environment variable
        firebase_creds_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
        
        if firebase_creds_json:
            # Parse credentials from JSON string
            creds_dict = json.loads(firebase_creds_json)
            creds = credentials.Certificate(creds_dict)
        else:
            # Try to load from file
            creds_path = os.getenv("FIREBASE_CREDENTIALS_PATH", "firebase-credentials.json")
            if os.path.exists(creds_path):
                creds = credentials.Certificate(creds_path)
            else:
                print("Warning: Firebase credentials not found. Some features may not work.")
                return
        
        firebase_admin.initialize_app(creds)
        print("Firebase Admin SDK initialized")
