package discovery

import (
	"context"
	"encoding/json"
	"log"
	"sync"
	"time"

	"github.com/bhawani-prajapat2006/0Xnet/backend/internal/models"
	"github.com/libp2p/go-libp2p/core/host"
	"github.com/libp2p/go-libp2p/core/network"
	"github.com/libp2p/go-libp2p/core/peer"
)

type DiscoveredDevice struct {
	DeviceID string // Peer ID string
	PeerID   peer.ID
}

type SessionDiscovery struct {
	host          host.Host
	localDeviceID string
	devices       map[peer.ID]*DiscoveredDevice
	mutex         sync.RWMutex
}

func NewSessionDiscovery(h host.Host) *SessionDiscovery {
	return &SessionDiscovery{
		host:          h,
		localDeviceID: h.ID().String(),
		devices:       make(map[peer.ID]*DiscoveredDevice),
	}
}

func (sd *SessionDiscovery) StartDiscovery() {
	log.Printf("Starting libp2p discovery for %s", sd.localDeviceID)

	// Notify when a new peer connects via the relay
	sd.host.Network().Notify(&network.NotifyBundle{
		ConnectedF: func(n network.Network, conn network.Conn) {
			pID := conn.RemotePeer()
			if pID == sd.host.ID() {
				return
			}
			sd.mutex.Lock()
			sd.devices[pID] = &DiscoveredDevice{
				DeviceID: pID.String(),
				PeerID:   pID,
			}
			sd.mutex.Unlock()
			log.Printf("✓ Peer Joined Relay: %s", pID.String()[:12])
		},
		DisconnectedF: func(n network.Network, conn network.Conn) {
			pID := conn.RemotePeer()
			sd.mutex.Lock()
			delete(sd.devices, pID)
			sd.mutex.Unlock()
			log.Printf("✗ Peer Left Relay: %s", pID.String()[:12])
		},
	})
}

func (sd *SessionDiscovery) GetAllSessions(localSessions []models.Session) []models.Session {
	allSessions := append([]models.Session{}, localSessions...)

	sd.mutex.RLock()
	peers := make([]peer.ID, 0, len(sd.devices))
	for pID := range sd.devices {
		peers = append(peers, pID)
	}
	sd.mutex.RUnlock()

	// Concurrent fetch would be better, but serial is safer for now
	for _, pID := range peers {
		sessions := sd.fetchSessionsFromPeer(pID)
		allSessions = append(allSessions, sessions...)
	}

	return allSessions
}

func (sd *SessionDiscovery) fetchSessionsFromPeer(pID peer.ID) []models.Session {
	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	// Open a libp2p stream instead of an HTTP connection
	stream, err := sd.host.NewStream(ctx, pID, "/0xnet/session-sync/1.0.0")
	if err != nil {
		log.Printf("Failed to open stream to %s: %v", pID, err)
		return nil
	}
	defer stream.Close()

	var sessions []models.Session
	if err := json.NewDecoder(stream).Decode(&sessions); err != nil {
		log.Printf("Failed to decode sessions from %s: %v", pID, err)
		return nil
	}

	return sessions
}

// HandleIncomingSessionRequest is called by the stream handler in main.go
func HandleIncomingSessionRequest(s network.Stream, sessions []models.Session) {
	defer s.Close()
	if err := json.NewEncoder(s).Encode(sessions); err != nil {
		log.Printf("Error sending sessions to peer: %v", err)
	}
}

func (sd *SessionDiscovery) GetDiscoveredDevices() []*DiscoveredDevice {
	sd.mutex.RLock()
	defer sd.mutex.RUnlock()
	devices := make([]*DiscoveredDevice, 0, len(sd.devices))
	for _, d := range sd.devices {
		devices = append(devices, d)
	}
	return devices
}