import { useState } from 'react';
import { voteRequest, voteReport } from '../lib/firestore';
import toast from 'react-hot-toast';

export function useVote() {
  const [voting, setVoting] = useState(false);

  const handleVoteRequest = async (requestId, userId, userName, teamId) => {
    setVoting(true);
    try {
      await voteRequest(requestId, userId, userName, teamId);
      toast.success('Đã xác nhận request');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi xác nhận');
    } finally {
      setVoting(false);
    }
  };

  const handleVoteReport = async (reportId, userId, userName, teamId) => {
    setVoting(true);
    try {
      await voteReport(reportId, userId, userName, teamId);
      toast.success('Đã xác nhận tố cáo');
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Lỗi khi xác nhận');
    } finally {
      setVoting(false);
    }
  };

  return { voting, handleVoteRequest, handleVoteReport };
}
