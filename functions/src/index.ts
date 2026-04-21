import { initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { HttpsError, onCall } from "firebase-functions/v2/https";

initializeApp();

function getMonthKey() {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

export const syncMonthlyCredits = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required");
  }

  const db = getFirestore();
  const userRef = db.collection("users").doc(request.auth.uid);
  const snapshot = await userRef.get();
  const monthKey = getMonthKey();

  if (!snapshot.exists) {
    await userRef.set({
      monthlyCredits: 10,
      creditResetAt: monthKey,
      updatedAt: Timestamp.now(),
    });
    return { monthlyCredits: 10, creditResetAt: monthKey };
  }

  const data = snapshot.data();
  if (data?.creditResetAt !== monthKey) {
    await userRef.update({
      monthlyCredits: 10,
      creditResetAt: monthKey,
      updatedAt: Timestamp.now(),
    });
    return { monthlyCredits: 10, creditResetAt: monthKey };
  }

  return {
    monthlyCredits: data?.monthlyCredits ?? 10,
    creditResetAt: data?.creditResetAt ?? monthKey,
  };
});

export const spendCreditForAiParticipant = onCall(async (request) => {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Login required");
  }

  const roomId = request.data?.roomId as string | undefined;
  if (!roomId) {
    throw new HttpsError("invalid-argument", "roomId is required");
  }

  const db = getFirestore();
  const roomRef = db.collection("rooms").doc(roomId);
  const userRef = db.collection("users").doc(request.auth.uid);

  await db.runTransaction(async (transaction) => {
    const [roomSnap, userSnap] = await Promise.all([transaction.get(roomRef), transaction.get(userRef)]);
    if (!roomSnap.exists) {
      throw new HttpsError("not-found", "Room not found");
    }
    if (roomSnap.data()?.hostId !== request.auth.uid) {
      throw new HttpsError("permission-denied", "Only host can add AI participants");
    }
    if (!userSnap.exists) {
      throw new HttpsError("failed-precondition", "User profile missing");
    }

    const monthKey = getMonthKey();
    const currentCredits =
      userSnap.data()?.creditResetAt === monthKey ? (userSnap.data()?.monthlyCredits as number) ?? 10 : 10;

    if (currentCredits < 1) {
      throw new HttpsError("resource-exhausted", "No credits left");
    }

    transaction.set(
      userRef,
      {
        monthlyCredits: currentCredits - 1,
        creditResetAt: monthKey,
        updatedAt: Timestamp.now(),
      },
      { merge: true },
    );
  });

  return { ok: true };
});
