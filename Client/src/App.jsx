import React, { useEffect } from "react";
import Home from "./pages/Home";
import getCurrentUser from "./features/getcurrentUser";
import { setUserData } from "./redux/userSlice";
import { useDispatch } from "react-redux";

const App = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    const restoreSession = async () => {
      const user = await getCurrentUser();
      // Only dispatch if we actually got a user back (guards against 401 resetting state)
      if (user) {
        dispatch(setUserData(user));
      }
    };
    restoreSession();
  }, [dispatch]);

  return (
    <>
      <Home />
    </>
  );
};

export default App;
