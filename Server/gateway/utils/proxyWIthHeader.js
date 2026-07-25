import proxy from "express-http-proxy"
export const proxyWithHeader = (serviceUrl) => {
    return proxy(serviceUrl,{
        proxyReqOptDecorator:(proxeyReqOpts, srcReq)=>{
            if (srcReq.user) {
                const userId = srcReq.user._id || srcReq.user.userId;
                if (userId) {
                    console.log("Forwarding x-user-id:", userId);
                    proxeyReqOpts.headers["x-user-id"] = String(userId);
                }
            }
            return proxeyReqOpts;
        }
    })
}

