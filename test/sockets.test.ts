import { createServer } from 'http';
import { Server } from 'socket.io';
import Client from 'socket.io-client';
import { setupSocket } from '../src/sockets';

describe('Socket.io template demo', () => {
    let io: Server;
    let httpServer: ReturnType<typeof createServer>;
    let address: { port: number };

    beforeAll((done) => {
        httpServer = createServer();
        io = new Server(httpServer, { cors: { origin: '*', methods: ['GET', 'POST'] } });
        setupSocket(io);

        httpServer.listen(() => {
            address = httpServer.address() as { port: number };
            done();
        });
    });

    afterAll((done) => {
        io.close();
        if (httpServer.listening) {
            httpServer.close(done);
        } else {
            done();
        }
    });

    it('connects and receives demo:state', (done) => {
        const clientSocket = Client(`http://localhost:${address.port}`);

        clientSocket.on('demo:state', (state) => {
            expect(state).toBeTruthy();
            clientSocket.close();
            done();
        });
    });
});